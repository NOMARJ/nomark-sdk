# W6 — Surface outcome verbs design proposal

**Status:** DRAFT — pending owner ack
**Scope:** add `DECIDE`, `CONFIGURE`, `EXPLORE`, `AUTHOR`, `ONBOARD`, `COLLECT` handlers to all 3 surface backends (react, vue, svelte). Extend each frozen `*_STYLE.md` with new contract sections.
**Goal:** drop 6 from `VERB_UNHANDLED` for surface — coverage 5/11 → 11/11.
**Risk:** highest contract-design surface area. Existing 5 verbs form a *read-only* dashboard; these 6 turn it *interactive*.

---

## 1. Spec signatures

| Verb | Category | Spec signature | Semantic |
|---|---|---|---|
| `DECIDE` | outcome | `(string, Option[], DataRef[], RuleRef[]?, Duration?, string?)` | evaluate options, commit to one |
| `CONFIGURE` | outcome | `(string, ParamSpec[], DataRef?, VerbRef)` | set parameters governing system behaviour |
| `EXPLORE` | outcome | `(string, DataRef \| ViewRef, Search?, Filter?, ViewRef?, Sort?)` | navigate, search, discover |
| `AUTHOR` | outcome | `(string, Schema, SaveMode, DataRef?, VerbRef, Duration?)` | create or edit structured content |
| `ONBOARD` | outcome | `(string, Step[], ProgressType, VerbRef)` | learn system, build mental model |
| `COLLECT` | present | `(CollectType, string, string, bool?, any?, Schema?, string?)` | gather input from actor |

These are interactive UI patterns — choice selectors, settings forms, search/browse, editors, wizards, input forms.

## 2. Key design decision — `DashboardState` expansion

Existing read-only state:
```ts
export type DashboardState = {
  values: Record<string, unknown>;
  status: 'idle' | 'loading' | 'empty';
  alerts: readonly string[];
};
```

Adding interactive verbs means components need to read user-entered state and emit events. Two state additions:

```ts
export type DashboardState = {
  values: Record<string, unknown>;
  status: 'idle' | 'loading' | 'empty';
  alerts: readonly string[];
  // NEW for W6:
  selections: Record<string, unknown>;  // DECIDE/EXPLORE/CONFIGURE picks
  drafts: Record<string, unknown>;      // AUTHOR/COLLECT/CONFIGURE in-progress edits
};
```

**Event handler convention:** rather than passing per-verb event handlers (callback proliferation), components emit `CustomEvent`s on a single dispatcher prop:

```ts
type DashboardDispatch = (event: { verb: string; id: string; action: string; payload: unknown }) => void;
```

Each interactive verb's emission renders the appropriate semantic HTML and calls `dispatch({...})` on user actions. Host wires `dispatch` to its own state/store.

**Rationale:** keeps the surface emission deterministic (no closure-captured state), lets the host integrate with any state management (Redux, Pinia, Svelte store, MobX). Matches the W3 pattern of "emit dumb HTML; host glues."

## 3. Per-verb HTML pattern (framework-agnostic semantic)

| Verb | Root element | Key data attrs | Children | User events |
|---|---|---|---|---|
| `DECIDE` | `<form>` | `data-decide='<id>' data-prompt='<prompt>'` | `<button data-option='<value>'>` per option | click → `{ action: 'select', payload: <value> }` |
| `CONFIGURE` | `<form>` | `data-configure='<id>'` | `<label>` + `<input>` per param | change → `{ action: 'set', payload: { <param>: <value> } }`; submit → `{ action: 'apply' }` |
| `EXPLORE` | `<section>` | `data-explore='<id>'` | `<input type='search'>` + `<ul>` results + sort/filter chips | search/filter → `{ action: 'query', payload: ... }` |
| `AUTHOR` | `<form>` | `data-author='<id>' data-save-mode='<mode>'` | schema-driven `<input>`/`<textarea>` | change → `{ action: 'edit', payload: ... }`; submit → `{ action: 'save' }` |
| `ONBOARD` | `<nav>` | `data-onboard='<id>'` | `<ol>` of steps + `<button data-step-action='next'>` | click → `{ action: 'advance' }` / `'skip'` / `'complete'` |
| `COLLECT` | `<label>` + `<input>` | `data-collect='<id>' data-collect-type='<type>'` | input element matching `CollectType` | change → `{ action: 'input', payload: <value> }` |

`CollectType` enum: `'text' | 'number' | 'date' | 'select' | 'checkbox' | 'file'`. Each maps to the obvious HTML control.

## 4. Per-framework emission shape

### React (`expected/react/Dashboard.tsx` pattern extension)
```tsx
function approval_choice(state: DashboardState, dispatch: DashboardDispatch): ReactNode {
  return (
    <form data-decide='approval_choice' data-prompt='Approve this transaction?'>
      <button type='button' data-option='approve' onClick={() => dispatch({ verb: 'DECIDE', id: 'approval_choice', action: 'select', payload: 'approve' })}>Approve</button>
      <button type='button' data-option='reject' onClick={() => dispatch({ verb: 'DECIDE', id: 'approval_choice', action: 'select', payload: 'reject' })}>Reject</button>
    </form>
  );
}
```

### Vue (`expected/vue/Dashboard.vue` extension)
```ts
function approval_choice(state: DashboardState, dispatch: DashboardDispatch): VNode {
  return h('form', { 'data-decide': 'approval_choice', 'data-prompt': 'Approve this transaction?' }, [
    h('button', { type: 'button', 'data-option': 'approve', onClick: () => dispatch({ verb: 'DECIDE', id: 'approval_choice', action: 'select', payload: 'approve' }) }, 'Approve'),
    h('button', { type: 'button', 'data-option': 'reject', onClick: () => dispatch({ verb: 'DECIDE', id: 'approval_choice', action: 'select', payload: 'reject' }) }, 'Reject'),
  ]);
}
```

### Svelte (`expected/svelte/Dashboard.svelte` extension)
```svelte
{#snippet approval_choice(state: DashboardState, dispatch: DashboardDispatch)}
  <form data-decide='approval_choice' data-prompt='Approve this transaction?'>
    <button type='button' data-option='approve' onclick={() => dispatch({ verb: 'DECIDE', id: 'approval_choice', action: 'select', payload: 'approve' })}>Approve</button>
    <button type='button' data-option='reject' onclick={() => dispatch({ verb: 'DECIDE', id: 'approval_choice', action: 'select', payload: 'reject' })}>Reject</button>
  </form>
{/snippet}
```

`dispatch` is a second parameter alongside `state`. The render entrypoint signature changes:
- React: `Dashboard(state, dispatch)` — was `Dashboard(state)`
- Vue: `defineProps<{ state: DashboardState; dispatch: DashboardDispatch }>()`
- Svelte: `let { state, dispatch }: { state: DashboardState; dispatch: DashboardDispatch } = $props()`

**This is a breaking change to the Dashboard signature.** Existing fixtures need to gain `dispatch` as a no-op when no interactive verbs are present. Or — only emit `dispatch` parameter if interactive verbs exist (analogous to W5's flow-detection branching). Owner pick.

## 5. Style contract additions

Three new sections appended to each `*_STYLE.md`:

### `*_INTERACTIVE.md` (or appendix to existing) — 4 sections per framework
1. **DashboardState shape** — the v2 type with `selections` + `drafts`.
2. **Dispatch convention** — `DashboardDispatch` type, event payload shape.
3. **Per-verb HTML** — copy of §3 table specialized for the framework's idiom.
4. **Backwards compatibility** — how Dashboard.tsx/vue/svelte for read-only compositions stays byte-exact.

The existing 3 STYLE docs stay frozen for the read-only patterns. New `*_INTERACTIVE.md` siblings are introduced for W6, frozen on the same pattern (owner ack → contract).

## 6. Fixture proposal

**New file:** `tests/resolvers/__fixtures__/composition-interactive.ts`

A 7-verb interactive dashboard composing all 6 new verbs + MONITOR/ARRANGE for layout:

```ts
{
  name: 'admin_console',
  version: '0.4.0',
  description: 'Interactive admin console: configure thresholds, decide on approvals, explore audit log, author rules, onboard new admins.',
  verbs: [
    { id: 'console', verb: 'MONITOR', params: { subject: 'admin operations', refresh: { value: 1, unit: 's' } } },
    { id: 'tabs', verb: 'ARRANGE', params: { type: 'tabs', density: 'comfortable', children: ['threshold_form', 'approval_choice', 'audit_search', 'rule_editor', 'admin_setup', 'admin_email'] } },
    { id: 'threshold_form', verb: 'CONFIGURE', params: { params: [{ key: 'threshold_usd', type: 'number' }, { key: 'alert_channel', type: 'text' }] } },
    { id: 'approval_choice', verb: 'DECIDE', params: { prompt: 'Approve this transaction?', options: [{ value: 'approve', label: 'Approve' }, { value: 'reject', label: 'Reject' }] } },
    { id: 'audit_search', verb: 'EXPLORE', params: { source: 'audit_log', search: { placeholder: 'Search events...' } } },
    { id: 'rule_editor', verb: 'AUTHOR', params: { schema: 'rules.v1', save_mode: 'manual' } },
    { id: 'admin_setup', verb: 'ONBOARD', params: { steps: [{ id: 'profile', label: 'Profile' }, { id: 'permissions', label: 'Permissions' }, { id: 'review', label: 'Review' }], progress_type: 'step' } },
    { id: 'admin_email', verb: 'COLLECT', params: { type: 'text', label: 'Admin email', name: 'email', required: true } },
  ],
}
```

Hand-author the byte-exact `Dashboard.tsx`, `Dashboard.vue`, `Dashboard.svelte` for this fixture, surface for owner ack BEFORE backend code (SUR-000 pattern, same as W3).

## 7. Backwards-compatibility approach

Two paths:

**Path A: signature-flag dispatcher.** Backends detect interactive verbs in the composition. If absent, emit Dashboard signature without dispatch (current). If present, emit with dispatch. Existing W3 fixtures stay byte-exact.

**Path B: always-emit dispatch.** Bump REACT/VUE/SVELTE_STYLE major version. Existing fixtures change to include the dispatch param (no-op for read-only). Cleaner code, breaks byte-exact.

Recommendation: **Path A**. Same pattern as W5's flow-detection. Preserves the SUR-000 byte-exact contracts already shipped.

## 8. Implementation parallelization plan

After ack, spawn 3 subagents in parallel (1 per surface backend file):
- Agent 1: `react/backend.ts` — add 6 emit handlers + extend postamble for dispatch param
- Agent 2: `vue/backend.ts` — same  
- Agent 3: `svelte/backend.ts` — same

Each runs against this design + the W6 hand-authored fixtures. I aggregate, run byte-exact tests, surface for ack.

## 9. Open questions

1. **Path A vs Path B (BC):** confirm A.
2. **`dispatch` as a positional arg or context object?** Proposal: positional — keeps emission terse and avoids a new IR `context` type.
3. **CONFIGURE form submit semantics:** does each `<input>` change dispatch, or only on form submit? Proposal: per-input `change` events for live state, plus an explicit `apply` event on submit.
4. **AUTHOR `Schema` representation:** opaque string ref (`'rules.v1'`) and host resolves, or inlined JSON Schema? Proposal: opaque string ref — backend doesn't render schema-driven inputs, just an `<output>`-shaped placeholder element with the schema id as a `data-schema` attribute.
5. **EXPLORE complexity:** full search+filter+sort or just the search input + result list? Proposal: minimal — search input + `<ul role='listbox'>` of result rows from `state.values[<dataref>]`. Defer filter/sort to W6.1.
6. **ONBOARD progress types:** `'step' | 'percent' | 'checklist'` — pick one for v1. Proposal: `'step'` only.

## 10. Test count estimate

- 3 backend byte-exact tests (one per surface label) for the new fixture
- 3 backwards-compatibility byte-exact tests for the existing W3 surface fixtures (re-confirmed)
- 1 mixed-manifest test (`resolveAll(comp, ['react','vue','svelte'])` for the interactive composition)
- ≈ +7 tests → after W4+W5+W6 ~152 total

---

**Ack required on:** §2 (state expansion), §4 (Dashboard signature change), §5 (style contract additions), §7 (BC approach), §9 open questions.

This wave has the most contract surface; recommend acking incrementally if you'd rather not blanket-ack §9.
