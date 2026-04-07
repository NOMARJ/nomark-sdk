# NOMARK SDK

[![npm engine](https://img.shields.io/npm/v/@nomark-ai/engine?label=%40nomark-ai%2Fengine)](https://www.npmjs.com/package/@nomark-ai/engine)
[![npm pro](https://img.shields.io/npm/v/@nomark-ai/pro?label=%40nomark-ai%2Fpro)](https://www.npmjs.com/package/@nomark-ai/pro)
[![PyPI](https://img.shields.io/pypi/v/nomark-engine)](https://pypi.org/project/nomark-engine/)
[![npm downloads](https://img.shields.io/npm/dm/@nomark-ai/engine)](https://www.npmjs.com/package/@nomark-ai/engine)
[![PyPI downloads](https://img.shields.io/pypi/dm/nomark-engine)](https://pypi.org/project/nomark-engine/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

**Stop training humans to talk to machines. Train the machine to understand the human.**

NOMARK is an outcome quality engine for AI agents. It learns what a specific human considers "good" — across sessions, platforms, and models — so agents deliver what was meant, not what was typed.

Models are commoditizing. Inference cost, context length, and benchmark scores converge across providers. But the gap between what a human means and what an agent delivers remains unsolved. NOMARK closes that gap.

## What It Does

- **Learns preferences** from interaction outcomes — not prompts, not configuration files
- **Resolves intent** from incomplete input ("make it shorter" → structured meaning)
- **Remembers across sessions** via a portable JSONL ledger
- **Works with any model** — Claude, GPT, Gemini, Llama, local models
- **Runs locally** — your data stays on your device unless you opt into sync

## Quick Start

```bash
npx nomark-engine
```

This creates your ledger, adds AI context to your project (CLAUDE.md, .cursor/rules, etc.), and prints next steps. Then:

```bash
npm install @nomark-ai/engine
```

```typescript
import { createResolver, parseLedger } from '@nomark-ai/engine'

const entries = parseLedger(ledgerContent)
const resolver = createResolver({ entries, context: 'code' })

// What does this user actually prefer?
const result = resolver.resolveAll()
for (const [dim, res] of Object.entries(result.dimensions)) {
  if (res.winner) {
    console.log(`${dim}: ${res.winner.target} (score: ${res.winner._score})`)
  }
}

// What do they mean by this?
const input = resolver.resolveInput('make it shorter')
for (const match of input.meaningMaps) {
  console.log(`${match.trigger} -> ${match.intent.join(', ')}`)
}
```

Or with Python:

```bash
pip install nomark-engine
```

```python
from nomark_engine import create_resolver, parse_ledger, ResolverConfig

entries = parse_ledger(open("nomark-ledger.jsonl").read())
resolver = create_resolver(ResolverConfig(entries=entries))

result = resolver.resolve_all()
for dim, res in result.dimensions.items():
    if res.winner:
        print(f"{dim}: {res.winner.pref.target} (score: {res.winner.score})")
```

## CLI

Import your existing conversation history — everything runs locally:

```bash
npx nomark import --platform chatgpt --file chatgpt-export.json
npx nomark profile

#   Tone:     Direct   ████████░░  0.87
#   Length:   Short    ███████░░░  0.74
#   Format:   Bullets  ██████░░░░  0.65
```

## How It Works

NOMARK maintains a portable JSONL ledger of five signal types learned from interaction outcomes:

| Signal | What It Captures |
|--------|-----------------|
| `pref` | Learned preferences — dimension, target, weight, scope |
| `map`  | Meaning maps — natural language triggers to structured intent |
| `asn`  | Defaults — field-level assumptions with accuracy tracking |
| `meta` | Session metadata — model, context, timestamps |
| `rub`  | Rubrics — graduated trust levels (ephemeral → pending → proven → trusted) |

The resolver scores preferences using weighted factors (specificity, evidence, recency, stability, portability) and flags low-confidence dimensions as **unstable** — recommending the agent ask instead of guess.

## Packages

| Package | Registry | License | What You Get |
|---------|----------|---------|-------------|
| [`@nomark-ai/engine`](packages/engine) | npm | Apache 2.0 | Resolver, ledger, decay, classifier, importers, sync |
| [`nomark-engine`](packages/engine-python) | PyPI | Apache 2.0 | Python port — identical resolution, Pydantic v2 models |
| [`nomark-engine`](packages/create-nomark-engine) | npm | Apache 2.0 | `npx nomark-engine` — project setup CLI |
| [`@nomark-ai/pro`](packages/pro) | npm | BSL 1.1 | Trust contracts, instinct engine, governance, critical-field gates |

The open engine is genuinely useful on its own. Pro adds the layers that enterprises need: trust-based autonomy control, pattern capture with confidence lifecycle, governance stages with audit trails, and schema-level gates that prevent agents from acting autonomously on high-risk fields.

```typescript
import { createEngine } from '@nomark-ai/pro'

const engine = createEngine({
  entries,
  context: 'code',
  trust: true,
  instincts: true,
  governance: true,
  criticalFields: true,
})

const result = engine.process('draft the email to the client', {
  schema: 'communication',
  fields: ['recipient', 'tone', 'content_facts'],
})

// Critical fields require human confirmation — the agent can't guess these
for (const gate of result.gate ?? []) {
  if (gate.tier === 'critical_ask') {
    console.log(`Confirm required: ${gate.field}`)
  }
}
```

## Architecture

```
@nomark-ai/engine (Apache 2.0)
├── Schema       Zod-validated signal types
├── Ledger       JSONL parser/writer with capacity constraints
├── Classifier   Input tier classification
├── Resolver     Weighted scoring with scope matching
├── Decay        Time-based decay with contradiction acceleration
├── Utility      Multi-factor scoring and capacity-bounded pruning
├── Importers    ChatGPT and Claude export migration
└── Sync         Supabase-backed cross-device sync with offline queue

@nomark-ai/pro (BSL 1.1)
├── Trust        Trust contract — breach taxonomy, autonomy gradient
├── Instincts    Pattern capture with confidence lifecycle
├── Governance   Lifecycle stages with verification and audit trails
├── Gate         Critical-field inference tiers (inferable → defaultable → must-ask)
└── Team         Multi-user sync and admin
```

## Development

```bash
npm install && npm run build && npm test
```

Python:

```bash
cd packages/engine-python
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]" && pytest
```

## License

- `@nomark-ai/engine` and `nomark-engine` — [Apache 2.0](LICENSE)
- `@nomark-ai/pro` — [Business Source License 1.1](packages/pro/LICENSE)
