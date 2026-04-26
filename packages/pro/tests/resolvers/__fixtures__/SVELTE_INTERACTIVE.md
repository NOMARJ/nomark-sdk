# SVELTE_INTERACTIVE — Svelte 5 interactive surface conventions

**Status:** APPROVED — frozen 2026-04-26 (W6 gate-2a)
**Scope:** rules the Svelte surface backend reproduces byte-for-byte when emitting `expected-interactive/svelte/Dashboard.svelte` for compositions with interactive verbs.
**Authority:** byte-exact equality against `expected-interactive/svelte/Dashboard.svelte`.
**Siblings:** SVELTE_STYLE.md (frozen 2026-04-26 W3) for read-only conventions; REACT_INTERACTIVE.md for the framework-agnostic contract (detection rule, DashboardState v2, DashboardDispatch shape, per-verb HTML pattern, action codes, BC).

This doc only documents Svelte-specific divergences for the interactive surface; everything else carries over from REACT_INTERACTIVE.md.

## Svelte-specific differences

- **Two `<script>` blocks.** `<script lang="ts" module>` exports `DashboardState` AND `DashboardDispatch` types. `<script lang="ts">` (instance) destructures `let { state, dispatch } = $props();` from runes.
- **Snippet signature.** `{#snippet <id>(state: DashboardState, dispatch: DashboardDispatch)}` — every interactive snippet, plus ARRANGE and MONITOR snippets in interactive compositions, take both args. Read-only fixtures keep `(state: DashboardState)` only.
- **Snippet ordering (leaf-first).** Interactive verbs emit before ARRANGE, ARRANGE before MONITOR. Same `leafFirst` sort as SVELTE_STYLE.md — interactive verbs sort with leaves (DISPLAY/STATUS/GUIDE) at rank 1.
- **Render entrypoint.** Bottom of file: `{@render admin_view(state, dispatch)}` — explicit dispatch arg.
- **Event handlers.** Lowercase HTML-attribute style: `onclick={() => dispatch({...})}` and `onchange={(e) => dispatch({..., payload: (e.currentTarget as HTMLInputElement).value })}`. Matches Svelte 5's HTML-attribute event convention (which deprecated `on:click=` in favor of `onclick=`).
- **`{@const}` for derived locals.** `{@const current = String(state.selections['admin_setup'] ?? 'profile')}` inside the ONBOARD snippet — Svelte's idiom for snippet-scoped constants.
- **`{#each}` for EXPLORE result lists.** Native iteration with `(r.id)` keying syntax replaces React's `.map()` + `key` prop.

## Boolean attributes

`required` (in COLLECT) emits as a bare attribute when `true`, omitted when `false`. The fixture has `required` (no `={true}` suffix) — Svelte recognises bare attributes as boolean-true.

## Backwards compatibility

The W3 `fund_flow_dashboard` fixture (read-only) emits byte-identical to before this contract — verified at every commit.

---

**Frozen:** 2026-04-26 by owner ack on W6 design proposal ("A k all").
