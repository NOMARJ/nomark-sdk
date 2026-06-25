# progress.md — nomark-sdk

> Claimed by: claude/festive-davinci-0yc858
> Brief: BRF-2026-04-12-nomark-cli
> Branch: claude/festive-davinci-0yc858

## Active Feature: F-API-KEYS CLI (nomark import CLI)

Build the `nomark` CLI package — npm-installable, authenticates via API keys, POSTs to the `process-import` edge function.

---

### STORY-001: Config + Login [complex]
- **Status:** DONE
- **Goal:** `nomark login` saves API key to `~/.nomark/config.json` (mode 0600); `loadApiKey()` helper reads env or file.
- **Done when:** `npm test` passes; `~/.nomark/config.json` has `api_key` field (snake_case); `fs.chmodSync` called; NOMARK_TOKEN env var respected.
- **Files:** `src/cli/config.ts`, `src/cli/login.ts`, `tests/cli/login.test.ts`
- **Notes:** vi.resetModules() required in beforeEach to avoid module caching of os.homedir(). Key shows last 5 chars.

### STORY-002: `whoami` command [moderate]
- **Status:** DONE
- **Goal:** `nomark whoami` prints authenticated user identifier (or exits non-zero with "Not authenticated" message).
- **Done when:** `npm test` passes.
- **Files:** `src/cli/whoami.ts`, `tests/cli/whoami.test.ts`

### STORY-003: Rewrite `import` command (cloud POST) [complex]
- **Status:** DONE
- **Goal:** `nomark import --platform chatgpt --file conversations.json` POSTs to Supabase edge function and prints ImportResult summary.
- **Done when:** `npm test` passes; import.test.ts covers chatgpt/claude/gemini happy path + error paths.
- **Files:** `src/cli/import.ts`, `tests/cli/import.test.ts`, `tests/fixtures/tiny-chatgpt.json`
- **Notes:** Endpoint: https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import

### STORY-004: CLI entrypoint + test coverage [complex]
- **Status:** DONE
- **Goal:** `src/cli/index.ts` routes all commands; tests pass.
- **Done when:** `npm test` exits 0 (279 tests passing across 29 test files).
- **Files:** `src/cli/index.ts`

### STORY-005: GitHub Actions publish workflow [moderate]
- **Status:** DONE
- **Goal:** `.github/workflows/publish.yml` publishes to npm on `v*.*.*` tags, runs tests first, fails-closed.
- **Files:** `.github/workflows/publish.yml`
- **Notes:** Scoped to `--workspace packages/engine`; removed `|| true` from publish commands.

### STORY-006: README update [trivial]
- **Status:** DONE
- **Goal:** README.md has full CLI docs (Install, Authenticate, Import, Managing API Keys).
- **Files:** `packages/engine/README.md`

---

## Current state

All stories DONE. 279 tests passing. PR #4 open as draft at NOMARJ/nomark-sdk#4.
CI: typescript ✅ python ✅. No review comments. Awaiting owner review and undraft.

## Session log

2026-06-25: Session started, brief claimed (BRF-2026-04-12-nomark-cli). All 6 stories completed. PR created.
2026-06-25: CI confirmed green (both checks passing). No review comments. Notified owner.
