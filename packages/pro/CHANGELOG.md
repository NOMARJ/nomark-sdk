# Changelog

All notable changes to `@nomark-ai/pro` are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.0 — 2026-04-18

### Added
- **Compute resolvers (F-RESOLVER):** `resolve(composition, target)` emits fixture-exact source for 6 compute backends — `typescript`, `python`, `bash`, `rust`, `go`, `json`.
- **React surface resolver (F-SURFACE-RESOLVER):** `resolve(surfaceComposition, 'react')` emits a `Dashboard.tsx` React component composed from 5 surface verbs (MONITOR / ARRANGE / DISPLAY / STATUS / GUIDE) using a deterministic template emit — single-quoted JSX attributes, 2-space indent, no Prettier dependency.
- **`resolveAll` mixed-family manifests:** single call now handles compute + surface targets together, returning a manifest keyed by target label.
- **Dispatcher ambiguity guard:** throws on ambiguous `TargetTag` inputs rather than silently routing (8-case coverage test).
- **BaseResolver generalisation:** surface harness shares the same base as compute resolvers; contract is enforced identically for both families.
- Public README updated to document 7 target labels and the `resolveAll` entry point.

### Tests
- 13 test files / 104 tests passing (vitest).
- `dist/` emits 4 files via tsup: `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`.

### Compatibility
- Minor bump — no breaking changes to the 0.1.x public API.
- `dependencies.@nomark-ai/engine` pinned to `^0.2.1` (tightened from `"*"` in 0.1.x for install stability).
- `peerDependencies.@nomark-ai/engine` unchanged: `>=0.1.0`.

## 0.1.2

Prior releases tracked outside this file.
