# CLAUDE.md — nomark-sdk

> Governed by CHARTER.md at repository root.

## Governance

This repo is governed by CHARTER.md (sourced from the NOMARK OS repo). Core principles are absolute:

- **No fake data** — never fabricate metrics, scores, or results without [MOCK] labels
- **No false completion** — never claim done without running and reading verification output
- **No confabulation** — never quote files from memory; read them first
- **Escalate before looping** — 2 failed attempts = stop, write BLOCKED, escalate
- **Admit uncertainty** — say "I'm not sure" when that's the truth

## Code Style

### TypeScript

- Prefer `type` over `interface`
- Never use `enum` — use string literal unions
- Explicit return types required
- No unused variables
- No `any` without explicit owner approval

### Python

- Type hints required on all function signatures
- Pydantic v2 models for data structures
- snake_case for functions and variables
- No bare `except` — always specify the exception type

### Both

- Read before editing — understand existing code first
- Minimal changes — only what's needed for the task
- No comments unless logic is non-obvious

## Testing

- **TypeScript:** vitest — run `npm test` from the relevant package directory
- **Python:** pytest — run from `packages/engine-python/.venv/bin/python -m pytest`
- All changes must have tests. No commits without passing tests.

## Package Parity

- `@nomark-ai/engine` (TypeScript) is the reference implementation
- `nomark-engine` (Python) must produce identical results for identical inputs
- When modifying resolver logic, decay formulas, or scoring: update both packages

## Publishing

- npm: `@nomark-ai/engine` (Apache 2.0), `@nomark-ai/pro` (BSL 1.1)
- PyPI: `nomark-engine` (Apache 2.0)
- Version bumps are manual and deliberate
- Never publish without full test suite passing

## DO NOT

- Modify scoring formulas without owner approval (these are patented)
- Add dependencies without approval
- Change the JSONL ledger format (it's a compatibility contract)
- Add features beyond what was asked
- Skip tests before commits
