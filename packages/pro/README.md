# @nomark-ai/pro

[![npm](https://img.shields.io/npm/v/@nomark-ai/pro)](https://www.npmjs.com/package/@nomark-ai/pro)
[![npm downloads](https://img.shields.io/npm/dm/@nomark-ai/pro)](https://www.npmjs.com/package/@nomark-ai/pro)
[![License](https://img.shields.io/badge/license-BSL%201.1-blue)](LICENSE)

Enterprise extensions for the NOMARK engine. Adds trust contracts, instinct capture, governance lifecycles, critical-field gates, and team sync on top of `@nomark-ai/engine`.

## Install

```bash
npm install @nomark-ai/engine @nomark-ai/pro
```

Requires Node.js 18+ and `@nomark-ai/engine` >= 0.1.0.

## Quick Start

```typescript
import { createEngine } from '@nomark-ai/pro'
import { parseLedger } from '@nomark-ai/engine'

const entries = parseLedger(ledgerContent)

const engine = createEngine({
  entries,
  context: 'code',
  trust: true,
  instincts: true,
  governance: true,
  criticalFields: true,
})

// Process input through the full engine
const result = engine.process('draft the email to the client', {
  schema: 'communication',
  fields: ['recipient', 'tone', 'content_facts'],
})

// Check which fields need human confirmation
for (const gate of result.gate ?? []) {
  if (gate.tier === 'critical_ask') {
    console.log(`Confirm required: ${gate.field}`)
  }
}
```

## Modules

### Trust Contract

Governs agent autonomy based on demonstrated reliability. Trust score starts at 1.0, earned in drops (verified story completions) and lost in buckets (breach events S0–S4).

| Autonomy Level | Score Range | Restrictions |
|----------------|-------------|-------------|
| Full | 1.5+ | Unrestricted |
| Trusted | 1.0–1.49 | Normal operation |
| Supervised | 0.5–0.99 | Mandatory verification |
| Restricted | 0.2–0.49 | No autonomous dispatch |
| Probation | 0.0–0.19 | Owner confirmation required |

### Instinct Engine

Pattern capture with confidence lifecycle. Instincts progress from `pending` through `proven` to `promoted`, with observation counting and confidence tracking.

```typescript
import { createInstinctStore, captureInstinct, reinforceInstinct } from '@nomark-ai/pro'

let store = createInstinctStore()
store = captureInstinct(store, 'fmt-01', 'prefers bullet points', ['format'], now)
store = reinforceInstinct(store, 'fmt-01', now) // confidence increases
```

### Governance Lifecycle

Stage-based execution with trust gates, artifact tracking, and audit trails. Ships with a default `CODE_LIFECYCLE` config or accepts custom stage definitions.

```typescript
import { createLifecycle, advanceStage, CODE_LIFECYCLE } from '@nomark-ai/pro'

const lifecycle = createLifecycle(CODE_LIFECYCLE, new Date().toISOString())
// Advance through stages: think → plan → build → verify
```

### Critical-Field Gate

Schema-level inference tiers that prevent autonomous agent action on high-risk fields:

| Tier | Name | Agent Behavior |
|------|------|---------------|
| 1 | Inferable | Resolve from preferences |
| 2 | Defaultable | Use defaults, allow override |
| 3 | Critical Ask | Must confirm with human |

Built-in schemas for `creative`, `decision`, and `communication` request types. Extensible with custom schemas.

### Team Sync & Admin

Multi-user team management with shared preference layers and Supabase-backed sync.

## License

Business Source License 1.1
