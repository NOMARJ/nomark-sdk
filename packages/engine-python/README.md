# nomark-engine

[![PyPI](https://img.shields.io/pypi/v/nomark-engine)](https://pypi.org/project/nomark-engine/)
[![PyPI downloads](https://img.shields.io/pypi/dm/nomark-engine)](https://pypi.org/project/nomark-engine/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

The open-core preference resolution engine for AI agents. Python port of `@nomark-ai/engine` — identical resolution logic, Pydantic v2 models.

## Install

```bash
pip install nomark-engine
```

Requires Python 3.10+.

## Quick Start

```python
from nomark_engine import create_resolver, parse_ledger, ResolverConfig

# Parse a NOMARK ledger (JSONL format)
entries = parse_ledger(open("nomark-ledger.jsonl").read())

# Create a resolver
resolver = create_resolver(ResolverConfig(entries=entries))

# Resolve all preference dimensions
result = resolver.resolve_all()
for dim, res in result.dimensions.items():
    if res.winner:
        print(f"{dim}: {res.winner.pref.target} (score: {res.winner.score})")

# Resolve intent from natural language
result = resolver.resolve_input("make it shorter")
for match in result.meaning_maps:
    print(f"Matched: {match.trigger} -> {match.intent}")
```

## Modules

### Schema

Pydantic v2 models for all five signal types: `SigPref`, `SigMap`, `SigAsn`, `SigMeta`, `SigRub`. Discriminated unions via `LedgerEntry`.

### Ledger

JSONL parser and writer with per-type capacity constraints and token estimation.

### Classifier

Input tier classification: pass-through, routing, or extraction.

### Resolver

Five-factor weighted scoring engine:

- **Specificity** (0.30) — compound scope > single scope > global
- **Evidence** (0.25) — signal count normalized to 20
- **Recency** (0.20) — linear decay over 180 days
- **Stability** (0.15) — contradiction ratio penalty
- **Portability** (0.10) — cross-context usage

Unstable dimensions (winner score < 0.4) recommend asking instead of guessing.

### Decay

Time-based weight decay with contradiction acceleration.

### Utility

Multi-factor utility scoring and capacity-bounded pruning.

## API Reference

### Core

| Export | Description |
|--------|-------------|
| `create_resolver(config)` | Create a resolver instance |
| `parse_ledger(content)` | Parse JSONL ledger content |
| `write_ledger(entries)` | Serialize entries to JSONL |
| `classify(input)` | Classify input tier |
| `compute_decay(weight, decay)` | Compute decayed weight |
| `utility_score(entry)` | Score entry utility |
| `prune_to_capacity(entries)` | Prune entries within capacity |

### Types

| Type | Description |
|------|-------------|
| `ResolverConfig` | Resolver configuration |
| `ResolverResult` | Full resolution output |
| `DimensionResult` | Single dimension with winner/runner-up |
| `LedgerEntry` | Discriminated union of signal entries |
| `SigPref` / `SigMap` / `SigAsn` / `SigMeta` / `SigRub` | Pydantic signal models |

## Parity

This package produces identical results to `@nomark-ai/engine` for identical inputs. The test suites validate cross-language consistency.

## License

Apache 2.0
