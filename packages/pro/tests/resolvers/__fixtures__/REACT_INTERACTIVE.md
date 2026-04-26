# REACT_INTERACTIVE — interactive surface fixture conventions

**Status:** APPROVED — frozen 2026-04-26 (W6 gate-2a)
**Scope:** rules the React surface backend reproduces byte-for-byte when emitting `expected-interactive/react/*.tsx` for compositions containing the 6 outcome verbs (DECIDE, CONFIGURE, EXPLORE, AUTHOR, ONBOARD, COLLECT).
**Authority:** byte-exact equality against `expected-interactive/react/Dashboard.tsx`.
**Sibling contract:** REACT_STYLE.md (frozen 2026-04-18 SUR-000) governs read-only compositions and shared React conventions. This document only documents what's *new* for interactive compositions; everything else carries over.

This document is frozen as contract on owner ack. Changes require a new owner-approval cycle AND a matching fixture-file update in the same commit.

## Detection rule

A composition is "interactive" iff it contains any verb in `{DECIDE, CONFIGURE, EXPLORE, AUTHOR, ONBOARD, COLLECT}`. Detection is a pure function of the composition's verbs (no external flags). Read-only compositions (only MONITOR/ARRANGE/DISPLAY/STATUS/GUIDE) keep the existing REACT_STYLE.md emission byte-exact — verified by the W3 fixture pin.

## DashboardState v2

Interactive compositions emit an extended state type:

```ts
export type DashboardState = {
  values: Record<string, unknown>;
  status: 'idle' | 'loading' | 'empty';
  alerts: readonly string[];
  selections: Record<string, unknown>;  // DECIDE/EXPLORE/ONBOARD picks
  drafts: Record<string, unknown>;      // AUTHOR/COLLECT/CONFIGURE in-progress edits
};
```

Read-only compositions keep the original 3-field type unchanged.

## Dispatch convention

```ts
export type DashboardDispatch = (event: { verb: string; id: string; action: string; payload: unknown }) => void;
```

`dispatch` is a positional second argument on every helper in interactive compositions:
- Top-level `Dashboard(state, dispatch)` exported from the file.
- Per-verb helpers all take `(state, dispatch)` even if they don't use dispatch (DISPLAY/STATUS/GUIDE included). Uniform call shape simplifies emission.
- Read-only compositions: helpers take `(state)` only — REACT_STYLE.md unchanged.

## Per-verb HTML contract

Each interactive verb emits one helper function returning `ReactNode` and rendering a single root element with `data-<verb-class>='<verb.id>'`:

| Verb | Root element | Key data attrs | Children + behavior |
|---|---|---|---|
| `DECIDE` | `<form>` | `data-decide='<id>' data-prompt='<prompt>'` | one `<button data-option='<value>'>` per option; click → `dispatch({verb:'DECIDE', id, action:'select', payload:<value>})` |
| `CONFIGURE` | `<form>` | `data-configure='<id>' data-prompt='<prompt>'` | one `<label>`+`<input>` per param, `<button>Apply</button>` at end; per-input `change`→`set`, button → `apply` |
| `EXPLORE` | `<section>` | `data-explore='<id>' data-prompt='<prompt>' data-source='<src>'` | `<input type='search'>` + `<ul role='listbox'>` of results from `state.values[<src>]`; search `change` → `query` |
| `AUTHOR` | `<form>` | `data-author='<id>' data-prompt='<prompt>' data-schema='<ref>' data-save-mode='<mode>'` | `<output data-schema-ref>`, `<textarea>`, `<button>Save</button>`; textarea `change` → `edit`, button → `save` |
| `ONBOARD` | `<nav>` | `data-onboard='<id>' data-prompt='<prompt>' data-progress-type='<type>'` | `<ol>` of `<li data-step data-active>`, then `<button data-step-action='advance'>` and `'skip'` buttons |
| `COLLECT` | `<label>` + `<input>` | `data-collect='<id>' data-collect-type='<type>'` | label text + input matching `CollectType`; input `change` → `input` |

Action codes are stable strings: `'select'`, `'set'`, `'apply'`, `'query'`, `'edit'`, `'save'`, `'advance'`, `'skip'`, `'input'`. Add new ones only via owner-acked extensions.

## Dispatch event shape

The dispatched event has 4 fields:
- `verb`: SCREAMING_SNAKE verb name (e.g., `'DECIDE'`)
- `id`: the verb's IR id (e.g., `'approval_choice'`)
- `action`: stable action code (table above)
- `payload`: action-specific payload

Hosts wire `dispatch` to their state management of choice — there's no opinion on Redux/Zustand/Context/etc.

## Schema-driven AUTHOR

`AUTHOR.params.schema` is an opaque string ref (`'rules.v1'`). The backend emits a placeholder `<output data-schema-ref='<ref>'>` showing the current draft, plus a `<textarea>` for raw editing. Schema-driven structured inputs (per-field, per-type) are deferred to W6.1 — host renders the structured form, our emission is the dumb placeholder.

## Backwards compatibility

Detection is per-composition. The existing W3 `fund_flow_dashboard` fixture (read-only) emits identically to before this contract — verified at every commit.

---

**Frozen:** 2026-04-26 by owner ack on W6 design proposal ("A k all").
