# VUE_INTERACTIVE — Vue interactive surface conventions

**Status:** APPROVED — frozen 2026-04-26 (W6 gate-2a)
**Scope:** rules the Vue surface backend reproduces byte-for-byte when emitting `expected-interactive/vue/Dashboard.vue` for compositions with interactive verbs.
**Authority:** byte-exact equality against `expected-interactive/vue/Dashboard.vue`.
**Siblings:** VUE_STYLE.md (frozen 2026-04-26 W3) for read-only conventions; REACT_INTERACTIVE.md for the framework-agnostic contract (detection rule, DashboardState v2, DashboardDispatch shape, per-verb HTML pattern, action codes, BC).

This doc only documents Vue-specific divergences for the interactive surface; everything else carries over from REACT_INTERACTIVE.md.

## Vue-specific differences

- **Render entrypoint.** `defineRender(() => admin_view([…children…]))` uses positional `(state, dispatch)` calls on every helper invocation: `threshold_form(props.state, props.dispatch)`. The `defineRender` callback structure is unchanged from VUE_STYLE.md — only the helper invocation arguments grow.
- **Props.** `defineProps<{ state: DashboardState; dispatch: DashboardDispatch }>()` — single `defineProps` call with both fields. Read-only compositions still use `defineProps<{ state: DashboardState }>()` byte-exact.
- **Event handlers.** `onClick: () => dispatch({...})` (Vue's camelCase event-prop convention via `h()`). For input changes: `onChange: (e: Event) => dispatch({..., payload: (e.target as HTMLInputElement).value })`.
- **Helper signatures.** `function <id>(state: DashboardState, dispatch: DashboardDispatch): VNode { ... }` — same uniform-positional convention as React.
- **VNode children.** `h('form', { 'data-decide': ..., 'data-prompt': ... }, [ h('button', {...}, '<label>'), ... ])` — children always wrapped in an array.

## Per-verb VNode shapes

Mirror REACT_INTERACTIVE.md's table. Every JSX `data-*` attribute becomes a quoted object key in `h()`. Every `onClick={...}` becomes `onClick: () => ...`. The HTML semantics (root element type, data attribute names, action codes) are framework-agnostic and identical to React.

## Type-only export

`DashboardState` and `DashboardDispatch` are exported from the `<script setup lang="ts">` block (Vue accepts type-only exports inside `<script setup>` since 3.3). External code that needs the types: `import type { DashboardState, DashboardDispatch } from './Dashboard.vue'`.

---

**Frozen:** 2026-04-26 by owner ack on W6 design proposal ("A k all").
