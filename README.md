# nomark-sdk

Monorepo for NOMARK SDK packages.

| Package | Registry | Description |
|---------|----------|-------------|
| `@nomark/engine` | npm | Open-core agent outcome quality resolver |
| `nomark-engine` | PyPI | Python port of the engine |
| `@nomark/pro` | npm | Trust contract, instinct engine, governance, critical-field gate |

## Structure

```
packages/
  engine/          @nomark/engine (TypeScript, npm)
  engine-python/   nomark-engine (Python, PyPI)
  pro/             @nomark/pro (TypeScript, npm)
```

## Development

```bash
npm install          # install all workspace dependencies
npm run build        # build all TypeScript packages
npm test             # run all tests
```

For the Python package:

```bash
cd packages/engine-python
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
```
