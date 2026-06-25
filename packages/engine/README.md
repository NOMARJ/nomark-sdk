# @nomark-ai/engine

[![npm](https://img.shields.io/npm/v/@nomark-ai/engine)](https://www.npmjs.com/package/@nomark-ai/engine)
[![npm downloads](https://img.shields.io/npm/dm/@nomark-ai/engine)](https://www.npmjs.com/package/@nomark-ai/engine)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

The open-core preference resolution engine for AI agents. Learns what humans mean from incomplete input by building a persistent ledger of preferences, meaning maps, and defaults across sessions and platforms.

## Install

```bash
# As a library
npm install @nomark-ai/engine

# As a CLI (no install required)
npx nomark --help
```

Requires Node.js 18+.

## Quick Start

```typescript
import { createResolver, parseLedger } from '@nomark-ai/engine'

// Parse a NOMARK ledger (JSONL format)
const entries = parseLedger(ledgerContent)

// Create a resolver scoped to a context
const resolver = createResolver({ entries, context: 'code' })

// Resolve all preference dimensions
const result = resolver.resolveAll()

for (const [dim, res] of Object.entries(result.dimensions)) {
  if (res.winner) {
    console.log(`${dim}: ${res.winner.target} (score: ${res.winner._score})`)
  }
}

// Resolve intent from natural language
const input = resolver.resolveInput('make it shorter')
for (const match of input.meaningMaps) {
  console.log(`${match.trigger} -> ${match.intent.join(', ')}`)
}
```

## Modules

### Schema

Zod-validated types for all five signal types: `pref`, `map`, `asn`, `meta`, `rub`. Enforces ISO dates, valid ranges, and structural correctness at parse time.

### Ledger

JSONL parser and writer with per-type capacity constraints. Handles `[sig:type] {json}` line format with built-in token estimation.

### Classifier

Classifies raw user input into tiers: pass-through (no extraction needed), routing (intent only), or extraction (structured preference signals).

### Resolver

The core scoring engine. Evaluates preferences using five weighted factors:

- **Specificity** (0.30) — compound scope > single scope > global
- **Evidence** (0.25) — signal count normalized to 20
- **Recency** (0.20) — linear decay over 180 days
- **Stability** (0.15) — contradiction ratio penalty
- **Portability** (0.10) — cross-context usage

Unstable dimensions (winner score < 0.4) are flagged with `action: 'ask'`.

### Decay

Time-based weight decay with contradiction acceleration. Preferences that are frequently contradicted decay faster.

### Utility

Multi-factor utility scoring for capacity-bounded pruning. When the ledger approaches capacity limits, low-utility entries are pruned first.

### Importers

Migrate conversation history from other platforms:

```typescript
import { parseChatGPTExport, parseClaudeExport, extractSignals, runMigration } from '@nomark-ai/engine'

const conversations = parseChatGPTExport(chatgptJson)
const signals = extractSignals(conversations)
const report = runMigration(signals, existingLedger)
```

Supported platforms: ChatGPT, Claude.

### Sync

Cross-device synchronization with Supabase (optional peer dependency):

```typescript
import { createSyncClient, OfflineQueue } from '@nomark-ai/engine'

const sync = createSyncClient({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_ANON_KEY,
})

await sync.push(entries)
const remote = await sync.pull()
```

Includes offline queue, conflict resolution, privacy filtering, and merge strategies.

## CLI

```bash
npx nomark login           # Save your API key
npx nomark whoami          # Check authentication status
npx nomark import --platform chatgpt --file conversations.json
npx nomark profile         # Show resolved preference profile
npx nomark review          # Review low-confidence signals
```

### Authenticate

Get an API key from [nomark.ai](https://nomark.ai) and run:

```bash
npx nomark login
```

You will be prompted to enter your key (`nomark_sk_...`). Alternatively, set the `NOMARK_TOKEN` environment variable to skip interactive login:

```bash
export NOMARK_TOKEN=nomark_sk_...
npx nomark import --platform chatgpt --file conversations.json
```

The key is stored in `~/.nomark/config.json` with permissions `0600`.

### Import

Import your conversation history to build your NOMARK preference profile:

```bash
npx nomark import --platform chatgpt --file conversations.json
npx nomark import --platform claude  --file claude-export.json
npx nomark import --platform gemini  --file takeout.json
```

**Supported platforms:**

| Platform | Export file | How to export |
|----------|-------------|---------------|
| `chatgpt` | `conversations.json` | Settings → Data controls → Export data |
| `claude`  | `claude-export.json` | Settings → Privacy → Export data |
| `gemini`  | `Takeout/...json`   | Google Takeout → Gemini Apps activity |

After a successful import you will see:

```
  Analyzed 142 conversations from chatgpt.
  Extracted 38 signals (12 high, 18 medium, 8 low confidence).
  Promoted 30 to your NOMARK profile.
```

### Managing API Keys

| Task | Command |
|------|---------|
| Save a new key | `npx nomark login` |
| Check current auth | `npx nomark whoami` |
| Update key | Run `npx nomark login` again — it overwrites the existing key |
| Remove key | Delete `~/.nomark/config.json` |

To use a different key for a single command without modifying the stored config:

```bash
NOMARK_TOKEN=nomark_sk_... npx nomark import --platform chatgpt --file conversations.json
```

## API Reference

### Core

| Export | Description |
|--------|-------------|
| `createResolver(config)` | Create a resolver instance |
| `parseLedger(content)` | Parse JSONL ledger content |
| `writeLedger(entries)` | Serialize entries to JSONL |
| `classify(input)` | Classify input tier |
| `computeDecay(weight, decay)` | Compute decayed weight |
| `utilityScore(entry)` | Score entry utility |
| `pruneToCapacity(entries)` | Prune entries within capacity |

### Types

| Type | Description |
|------|-------------|
| `ResolverConfig` | Resolver configuration (entries, context, topic) |
| `ResolverResult` | Full resolution output (dimensions, meaning maps, defaults) |
| `DimensionResult` | Single dimension resolution with winner/runner-up |
| `LedgerEntry` | Union of all signal entry types |
| `SigPref` / `SigMap` / `SigAsn` / `SigMeta` / `SigRub` | Individual signal types |

## License

Apache 2.0
