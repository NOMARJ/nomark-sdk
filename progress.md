# nomark CLI — BRF-2026-04-12-nomark-cli

## Feature: F-API-KEYS-CLI (nomark import CLI)
Branch: claude/festive-davinci-ysm7md

### STORY-CLI-001: Config — token field, NOMARK_TOKEN env, chmod 0600
- **Status:** DONE
- **Goal:** NomarkConfig stores token; saveConfig writes api_key in JSON and chmods 0600
- **Done when:** Tests in tests/cli/config.test.ts pass

### STORY-CLI-002: login command
- **Status:** DONE
- **Goal:** `nomark login` reads NOMARK_TOKEN or prompts, validates vs process-import, saves to config
- **Done when:** Tests in tests/cli/login.test.ts pass

### STORY-CLI-003: whoami command
- **Status:** DONE
- **Goal:** `nomark whoami` reads token, shows auth status or "Not authenticated" + exit 1
- **Done when:** Tests in tests/cli/whoami.test.ts pass

### STORY-CLI-004: import command — API-backed, 3 platforms
- **Status:** DONE
- **Goal:** `nomark import --platform chatgpt|claude|gemini --file X` POSTs to process-import
- **Done when:** Tests in tests/cli/import-api.test.ts pass

### STORY-CLI-005: index.ts — async main, login/whoami routes, version
- **Status:** DONE
- **Goal:** main() is async, routes login+whoami, VERSION = '0.2.1'
- **Done when:** tsc --noEmit passes

### STORY-CLI-006: Test coverage ≥80%
- **Status:** DONE
- **Goal:** npm test exits 0, ≥80% line coverage on src/cli/
- **Done when:** npm test -- --coverage shows ≥80%

### STORY-CLI-007: publish.yml
- **Status:** DONE
- **Goal:** .github/workflows/publish.yml publishes on v*.*.* tag push
- **Done when:** File exists and YAML is valid

### STORY-CLI-008: README
- **Status:** DONE
- **Goal:** README.md has ## Install, ## Authenticate, ## Import, ## Managing API Keys
- **Done when:** Sections exist with runnable examples

## Current state
All stories done. PR created on claude/festive-davinci-ysm7md.
