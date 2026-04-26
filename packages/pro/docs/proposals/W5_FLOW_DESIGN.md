# W5 — Flow verbs design proposal (dispatcher refactor)

**Status:** DRAFT — pending owner ack
**Scope:** add `AWAIT`, `BRANCH`, `SPLIT`, `MERGE`, `GATE`, `SIGNAL`, `TERMINATE` handlers to all 4 compute backends. Refactor postamble dispatch from linear-chain to flow-aware graph.
**Goal:** drop 7 more from `VERB_UNHANDLED` — compute coverage 13/20 → 20/20 (full coverage assuming W4 also lands).
**Risk:** highest of the three remaining waves. Touches dispatcher emission across 4 backends.

---

## 1. Spec signatures

| Verb | Spec signature | Semantic |
|---|---|---|
| `AWAIT` | `(EventSpec, Duration?, VerbRef?) → Payload` | block until event, time, or signal |
| `BRANCH` | `(Payload, Condition[], VerbRef) → VerbRef` | exclusive conditional path selection |
| `SPLIT` | `(Payload, Strategy, VerbRef[] \| ConditionalPath[]) → ExecutionRef[]` | fan-out to parallel executions |
| `MERGE` | `(ExecutionRef[], Strategy, Duration?, Expression?) → Payload` | fan-in from parallel executions |
| `GATE` | `(Payload, ActorSpec, string, string[]?, Duration?, VerbRef?) → Decision` | pause for human decision |
| `SIGNAL` | `(SystemSpec, SignalSpec, Duration?, VerbRef?) → Payload` | await system or agent response |
| `TERMINATE` | `(string, Status, VerbRef[]?) → void` | kill entire execution, all branches |

All except TERMINATE produce a Payload that downstream verbs consume. TERMINATE is the only one that explicitly halts.

## 2. Dispatcher refactor — minimal & backwards-compatible

**Constraint:** existing fixtures (`daily_fund_flow_etl`, `archive_compaction`) must remain byte-exact. They have NO flow verbs, so their dispatcher emission must stay unchanged.

**Approach:** The dispatcher emits one of two forms based on whether the composition contains any flow verbs:

- **Linear form (current):** when no flow verbs, emit the existing switch-and-chain dispatcher. Byte-identical to today.
- **Graph form (new):** when flow verbs are present, emit a graph-aware dispatcher that respects per-verb `next` pointers, conditional dispatch from BRANCH/GATE, parallel SPLIT/MERGE via `Promise.all`/`asyncio.gather`/`tokio::join!`, and TERMINATE-throws-sentinel.

**Detection:** a verb's `verb` field is in `{AWAIT, BRANCH, SPLIT, MERGE, GATE, SIGNAL, TERMINATE}`. If any present → graph form.

**Backwards compatibility test:** the new harness asserts that compositions WITHOUT flow verbs produce the SAME output as before this PR. We keep snapshot tests against the existing W1+W2 fixtures.

## 3. IR shape additions

The current `Verb` type has `id`, `verb`, `params?`, `entity?`, `next?`. Most flow verbs need richer parameters; all reuse `params` but with verb-specific shapes:

```ts
// BRANCH
{ id: 'route_by_amount', verb: 'BRANCH', params: {
    conditions: [
      { when: 'amount > 1000', then: 'high_value_path' },
      { when: 'amount > 0',    then: 'normal_path' },
    ],
    default: 'reject_path',  // VerbRef fallback
  } }

// SPLIT
{ id: 'fan_out', verb: 'SPLIT', params: {
    strategy: 'parallel',  // 'parallel' | 'broadcast' | 'partition'
    targets: ['process_north', 'process_south', 'process_east'],
  } }

// MERGE
{ id: 'fan_in', verb: 'MERGE', params: {
    sources: ['process_north', 'process_south', 'process_east'],
    strategy: 'all',  // 'all' | 'first' | 'majority'
    timeout_ms: 30000,
    combine: 'concat',  // expression for combining results
  } }

// GATE
{ id: 'human_review', verb: 'GATE', params: {
    actor: { role: 'compliance_officer' },
    prompt: 'Approve this transaction?',
    options: ['approve', 'reject', 'escalate'],
    timeout_ms: 86400000,
    default_route: 'escalate_path',
  } }

// AWAIT
{ id: 'wait_for_settlement', verb: 'AWAIT', params: {
    event: { topic: 'settlement.completed' },
    timeout_ms: 3600000,
    timeout_route: 'timeout_handler',
  } }

// SIGNAL
{ id: 'notify_external', verb: 'SIGNAL', params: {
    system: 'payment-gateway',
    signal: { type: 'webhook', url: 'https://...' },
    timeout_ms: 30000,
    timeout_route: 'fallback',
  } }

// TERMINATE
{ id: 'kill_pipeline', verb: 'TERMINATE', params: {
    reason: 'compliance violation',
    status: 'failed',
    cleanup: ['rollback_persist'],  // optional VerbRef[] for cleanup
  } }
```

**Successor pointer:** verbs may carry an explicit `next: string` (already in the Verb type). For graph form, `next` overrides composition-array order. For linear form (no flow verbs), `next` is ignored and array order rules.

## 4. Per-verb emission shape (TypeScript reference)

### BRANCH
```ts
async function route_by_amount(ctx: Ctx): Promise<any> {
  const input = ctx.input;
  if (__predicate("amount > 1000", input)) return __execute("high_value_path", ctx);
  if (__predicate("amount > 0", input))    return __execute("normal_path", ctx);
  return __execute("reject_path", ctx);
}
```

### SPLIT (parallel strategy)
```ts
async function fan_out(ctx: Ctx): Promise<any[]> {
  const targets = ["process_north", "process_south", "process_east"];
  const results = await Promise.all(targets.map(async (t) => {
    const branchCtx: Ctx = { ...ctx, input: ctx.input, values: {}, receipts: {} };
    await __execute(t, branchCtx);
    return branchCtx.values[t];
  }));
  return results;
}
```

### MERGE
```ts
async function fan_in(ctx: Ctx): Promise<any> {
  const sources = ["process_north", "process_south", "process_east"];
  const splitResults = ctx.values["fan_out"] ?? [];
  return splitResults.flat();  // 'concat' strategy
}
```

### GATE
```ts
async function human_review(ctx: Ctx): Promise<any> {
  const decision = (globalThis as any).__gate?.({ prompt: "Approve this transaction?", options: ["approve","reject","escalate"], actor: { role: "compliance_officer" } }, ctx.input);
  if (!decision) return __execute("escalate_path", ctx);
  return decision;
}
```

### AWAIT
```ts
async function wait_for_settlement(ctx: Ctx): Promise<any> {
  const ev = await Promise.race([
    (globalThis as any).__await?.({ topic: "settlement.completed" }, ctx),
    new Promise(res => setTimeout(() => res(null), 3600000)),
  ]);
  if (ev === null) return __execute("timeout_handler", ctx);
  return ev;
}
```

### SIGNAL
```ts
async function notify_external(ctx: Ctx): Promise<any> {
  const r = await Promise.race([
    (globalThis as any).__signal?.("payment-gateway", { type: "webhook", url: "https://..." }, ctx),
    new Promise(res => setTimeout(() => res(null), 30000)),
  ]);
  if (r === null) return __execute("fallback", ctx);
  return r;
}
```

### TERMINATE
```ts
async function kill_pipeline(ctx: Ctx): Promise<never> {
  // Run cleanup chain first
  for (const cid of ["rollback_persist"]) await __execute(cid, ctx);
  throw new __TerminateError("compliance violation", "failed");
}
```

A new `__TerminateError` class is added to the preamble; the top-level `run()` catches it and short-circuits cleanly.

## 5. Per-backend strategy

| Verb | TS | Python | Rust | SQL |
|---|---|---|---|---|
| BRANCH | `__execute(target, ctx)` chain | `await _execute(target, ctx)` | `Box::pin(_execute(target, ctx)).await?` | `-- BRANCH <id>: routing in host` (comment-only + warning) |
| SPLIT | `Promise.all(...)` | `await asyncio.gather(...)` | `tokio::try_join!` | `-- SPLIT <id>: fan-out in host` |
| MERGE | reads `ctx.values["<split_id>"]` | reads `ctx.values["<split_id>"]` | reads `ctx.values["<split_id>"]` | `-- MERGE <id>: fan-in in host` |
| GATE | host-injected `globalThis.__gate` | host-injected `globals().get("__gate__")` | host-injected fn pointer (feature flag) | `-- GATE <id>: human-in-loop in host` |
| AWAIT | `Promise.race` with timeout | `asyncio.wait_for` | `tokio::time::timeout` | `-- AWAIT <id>: blocking in host` |
| SIGNAL | `globalThis.__signal` w/ timeout | `globals().get("__signal__")` w/ timeout | host fn w/ timeout | `-- SIGNAL <id>: dispatch in host` |
| TERMINATE | throw `__TerminateError` | raise `TerminateError` | `Err(anyhow!("__TERMINATE: ..."))` w/ propagation | `-- TERMINATE: ROLLBACK; ABORT;` (postgres/sqlite); `ROLLBACK;` (mysql) |

SQL gets fixed-spec warnings for all flow verbs (consistent with EMIT/RETRY/etc. handling).

## 6. Fixture proposal

Two fixtures — keep them small and focused:

### Fixture A — `composition-flow-routing.ts` (BRANCH + TERMINATE)
A 4-verb composition: FETCH → BRANCH → either MAP-and-PERSIST or TERMINATE.

### Fixture B — `composition-flow-parallel.ts` (SPLIT + MERGE + AWAIT + GATE + SIGNAL)
A 6-verb composition: FETCH → SPLIT → 3-way fan-out → AWAIT (settlement) → MERGE → GATE → SIGNAL.

Splitting into two fixtures keeps each byte-exact file <300 lines and isolates regression risk.

## 7. Backwards-compatibility guarantee — explicit test

Add a new test asserting that emission for `daily_fund_flow_etl` and `archive_compaction` is byte-equal to the existing pinned fixtures AFTER the dispatcher refactor lands. This is the existing harness, just re-confirmed in the W5 PR commit message.

If any byte changes appear in those fixtures, the PR fails — the refactor is gated on linear-form preservation.

## 8. Implementation parallelization plan

After ack, spawn 4 subagents in parallel (1 per compute-backend file). Each:
- Adds the 7 emit handlers with the design's per-backend shape
- Modifies the postamble to detect flow verbs and switch between linear/graph form
- Runs the existing harness to confirm linear form is unchanged
- Generates output for both new W5 fixtures and surfaces diff

I aggregate, generate output via resolver, surface for gate-2b ack, freeze fixtures + tests.

## 9. Open questions (need owner direction)

1. **TERMINATE in SQL:** emit `ROLLBACK;` or comment-only? Proposal: `-- TERMINATE <id>: ROLLBACK; -- abort transaction` for all 3 dialects (lets SQL semi-honor termination).
2. **GATE/AWAIT/SIGNAL host injection convention:** `globalThis.__gate` for TS, `globals().get("__gate__")` for Python, what for Rust? Proposal: trait-object `Arc<dyn HostHooks>` injected via Ctx.
3. **SPLIT context isolation:** does each parallel branch get an isolated Ctx (so receipts don't trample) or shared Ctx (so values cross-pollinate)? Proposal: isolated, then merged Ctx state on MERGE — matches sagas pattern.
4. **MERGE strategies:** `'all' | 'first' | 'majority' | <expression>` — implement all four or owner-pick a subset?
5. **AWAIT timeout fallback:** if `timeout_route` not specified, throw vs. return null? Proposal: throw `TimeoutError` with `verb_id` payload.

## 10. Test count estimate

- 12 backend byte-exact tests (4 backends × 2 fixtures, but SQL also × 3 dialects so really 6 × 2 = 12)
- 6 procedural / SQL warnings assertions
- 2 backwards-compatibility byte-exact assertions for existing fixtures
- ≈ +20 tests → ~145 total after W4+W5

---

**Ack required on:** §2 (refactor approach), §3 (IR shape additions), §5 (per-backend strategy), §7 (BC guarantee), §9 open questions.
