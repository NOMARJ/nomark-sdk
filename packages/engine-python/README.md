# nomark-engine

Open-core agent outcome quality resolver. Understands what a human means from incomplete input by learning preferences across sessions and platforms.

## Install

```bash
pip install nomark-engine
```

## Quick start

```python
from nomark_engine import create_resolver, parse_ledger, ResolverConfig

# Parse a NOMARK ledger
entries = parse_ledger(open("nomark-ledger.jsonl").read())

# Create resolver
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

- **Schema** — Pydantic v2 models for all signal types (pref, map, asn, meta, rub)
- **Classifier** — Input tier classification (pass-through, routing, extraction)
- **Resolver** — MEE weighted scoring with scope matching and instability detection
- **Ledger** — JSONL parser/writer with capacity constraints
- **Decay** — Time-based decay with contradiction acceleration
- **Utility** — Multi-factor utility scoring and capacity-bounded pruning

## License

Apache 2.0
