# W4 — Resilience verbs design proposal

**Status:** DRAFT — pending owner ack
**Scope:** add `RETRY`, `COMPENSATE`, `ERROR` handlers to all 6 compute backends (TS, Python, Rust, sql-postgres, sql-sqlite, sql-mysql).
**Goal:** drop 3 more from the `VERB_UNHANDLED` list — compute coverage 10/20 → 13/20.
**Pattern:** mirror W2 path-B (draft handlers → generate → owner ack candidate output → freeze).

---

## 1. Spec signatures (from `@nomark/intents@0.4.0` Appendix C)

| Verb | Category | Spec signature | Semantic |
|---|---|---|---|
| `RETRY` | resilience | `(VerbRef, RetryPolicy, ErrorRoute) → Payload \| ErrorRoute` | re-attempt wrapped verb on failure |
| `COMPENSATE` | resilience | `(Receipt, VerbRef, bool, string?) → Receipt` | reverse completed operation using receipt |
| `ERROR` | resilience | `(VerbRef, ErrorType[], VerbRef, bool?) → Payload \| Terminate` | catch failure, route to handler |

All three take `VerbRef` parameters — i.e., they decorate or reference *another* verb in the composition.

## 2. Key design decision — target-verb representation

The cleanest IR shape avoids needing a new `flow: 'helper'` field. Resilience verbs **inline** their target's full intent rather than referencing a sibling verb id:

```ts
{
  id: 'fetch_with_retry',
  verb: 'RETRY',
  params: {
    of: { verb: 'FETCH', params: { source: { type: 'http', config: { url: '...' } } } },
    policy: { max: 3, delay_ms: 1000, backoff: 'exponential', jitter: true },
    error_route: 'handle_error',  // optional: verb id to dispatch to on exhaustion
  },
}
```

**Rationale:** the dispatcher stays linear. Each resilience verb is a single switch case; its handler emits a function that wraps the target's emit logic in `__retry`/try-catch/receipt-rollback. No "secondary verbs" concept needed. Existing W1+W2 fixtures stay byte-exact (their dispatchers are unchanged).

**Alternative considered:** target as `string` (verb id), with the target verb sitting as a separate entry in `verbs: []` marked as `flow: 'helper'`. Rejected — needs IR augmentation, and "secondary" verbs muddy the per-verb test pattern.

## 3. Per-verb emission shape (TypeScript reference impl)

### RETRY

```ts
async function fetch_with_retry(ctx: Ctx): Promise<any> {
  return await __retry(async () => {
    // [inlined target body — same shape FETCH would produce]
    const r = await fetch("https://api.example.com/data", {});
    return await r.json();
  }, 3, 1000, "exponential", true);
}
```

The `__retry` helper is already in the preamble — no new helpers needed. The target's body is rendered by reusing the existing per-verb emit, called with the inlined `params`.

### COMPENSATE

```ts
async function rollback_upsert(ctx: Ctx): Promise<any> {
  const receipt = ctx.receipts["upsert_daily"];
  if (!receipt) throw new Error("COMPENSATE rollback_upsert: no receipt for upsert_daily");
  if (!receipt.reversible) throw new Error("COMPENSATE rollback_upsert: receipt is non-reversible");
  // [inlined reverse target body — typically a DELETE]
  const { default: pg } = await import("pg");
  const client = new pg.Client({"__rawJs":"process.env.DATABASE_URL"});
  await client.connect();
  try {
    await client.query(`DELETE FROM fund_flow_daily WHERE id = $1`, [receipt.id]);
  } finally { await client.end(); }
  return __receipt("compensate:upsert_daily", false);
}
```

Params: `{ receipt_from: <verb id>, reverse: { verb, params }, idempotent: bool, reason: string }`.

### ERROR

```ts
async function safe_fetch(ctx: Ctx): Promise<any> {
  try {
    // [inlined target body]
    const r = await fetch("https://api.example.com/data", {});
    return await r.json();
  } catch (e: any) {
    const matches = ["NetworkError", "TimeoutError"].some(t => e?.name === t || e?.code === t);
    if (matches) {
      // [inlined handler body]
      console.warn("safe_fetch: routing to handler");
      return ctx.input;
    }
    throw e;
  }
}
```

Params: `{ of: { verb, params }, catch: string[], handler: { verb, params }, terminate_on_match?: bool }`.

## 4. Per-backend translation table

| | TS | Python | Rust | SQL |
|---|---|---|---|---|
| RETRY | `__retry(async () => {...}, ...)` | `await _retry(lambda: ..., ...)` | `retry(\|\| async { ... }, ...).await` | comment + bare DDL — retry not in SQL |
| COMPENSATE | reads `ctx.receipts[id]`, runs reverse inline | reads `ctx.receipts[id]`, runs reverse inline | reads `ctx.receipts.get(id)`, runs reverse inline | `-- COMPENSATE <id>: reverse via host runtime`, then bare reverse SQL if expressible |
| ERROR | `try { ... } catch (e) { if (matches) { handler } else throw }` | `try: ... except E as e: ... if matches: handler else: raise` | `match target().await { Ok(v) => v, Err(e) if matches => handler.await?, Err(e) => return Err(e) }` | comment-only — `--ERROR <id>: error routing in host` |

SQL is mostly comment-only for resilience (consistent with EMIT). The fixed-spec warnings extend:
- `verb RETRY (<id>) cannot retry in SQL compute — host required`
- `verb COMPENSATE (<id>) requires runtime receipt tracking — host required`
- `verb ERROR (<id>) requires error routing in host runtime`

## 5. Fixture proposal

**New file:** `tests/resolvers/__fixtures__/composition-resilience-verbs.ts`

```ts
export const FIXTURE_RESILIENCE_COMPOSITION: Composition = {
  name: 'resilient_etl',
  version: '0.4.0',
  description: 'ETL with retried fetch, error-handled validate, and a compensating undo for the persist step.',
  verbs: [
    {
      id: 'fetch_with_retry', verb: 'RETRY',
      params: {
        of: { verb: 'FETCH', params: { source: { type: 'http', config: { url: 'https://api.example.com/data' } } } },
        policy: { max: 3, delay_ms: 1000, backoff: 'exponential', jitter: true },
      },
    },
    {
      id: 'safe_validate', verb: 'ERROR',
      params: {
        of: { verb: 'VALIDATE', params: { rules: [{ field: 'id', check: 'required' }] } },
        catch: ['ValidationError'],
        handler: { verb: 'EMIT', params: { target: { type: 'slack', config: { channel: '#alerts' } } } },
      },
    },
    { id: 'persist_data', verb: 'PERSIST', params: { sink: { type: 'sql', config: { table: 'records' } }, mode: 'insert' } },
    {
      id: 'rollback_persist', verb: 'COMPENSATE',
      params: {
        receipt_from: 'persist_data',
        reverse: { verb: 'DELETE', params: { sink: { type: 'sql', config: { table: 'records' } }, predicate: 'id = $1' } },
        idempotent: true,
        reason: 'rollback failed pipeline',
      },
    },
  ],
}
```

Test pattern follows W2: 6 byte-exact backend pins + 1 procedural-clean-warnings + 1 SQL-warnings-only.

## 6. Implementation parallelization plan

After ack, spawn 4 subagents in parallel (1 per compute-backend file):
- Agent 1: `typescript/backend.ts` — add 3 emit handlers + register
- Agent 2: `python/backend.ts` — add 3 emit handlers + register
- Agent 3: `rust/backend.ts` — add 3 emit handlers + register
- Agent 4: `sql/backend.ts` — add 3 emit handlers + register, extend SQL fixed-spec warning generators

Each agent runs against this design doc's Section 3 and the W4 fixture from Section 5, generates output, hands back diff. I aggregate, generate full output via the resolver, surface for gate-2b ack, freeze fixtures + add byte-exact test.

## 7. Open questions

1. **Inline target IR shape:** should `RETRY.params.of` use the same `{ verb, params }` shape used in `nested compositions`, or a flat shape? Decision needed for IR consumers downstream.
2. **COMPENSATE reverse semantics for non-DB sinks:** if PERSIST sank to a queue/blob/HTTP, what does "reverse" emit? Proposal: `--COMPENSATE not expressible for non-SQL sinks` warning. Owner pick.
3. **ERROR `catch` matching semantics:** match by `e.name` (JS) / `type(e).__name__` (Py) / typed error variant (Rust)? Proposal: name-based string match across all backends, since spec calls them `ErrorType[]` (strings).
4. **Resilience SQL emission:** comment-only with new fixed-spec warning, or attempt `BEGIN ... ROLLBACK` for COMPENSATE? Proposal: comment-only — SQL is too dialect-specific for generic compensate code.

## 8. Test count estimate

- 6 backend byte-exact tests (one per compute label)
- 1 procedural-no-warnings assertion
- 1 SQL-fixed-spec-warnings-only assertion
- ≈ +8 tests → 117 → ~125

---

**Ack required on:** §2 (target representation), §4 (SQL strategy), §5 (fixture composition), §7 open questions.
