import * as fs from 'node:fs'
import * as path from 'node:path'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'

const LEDGER_FILE = 'nomark-ledger.jsonl'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function seedLedger(): string {
  const meta = {
    profile: {},
    signals: 0,
    by_ctx: {},
    by_out: {},
    avg_conf: 0,
    avg_q: 0,
    updated: today(),
  }
  return `[sig:meta] ${JSON.stringify(meta)}\n`
}

const AI_CONTEXT = `## nomark-engine — Preference Resolver

This project uses \`@nomark-ai/engine\` to resolve user preferences from a portable JSONL ledger.

### Ledger location
\`./nomark-ledger.jsonl\` — each line is \`[sig:TYPE] {json}\`. Five signal types:
- **pref** — learned preferences (dimension + target + weight, max 20)
- **map** — meaning maps: natural language trigger → structured intent (max 10)
- **asn** — field defaults with accuracy tracking (max 5)
- **meta** — session metadata and aggregate stats (max 1)
- **rub** — rubrics with graduated trust levels (max 4)

Total capacity: 40 entries (~3 KB). The ledger is the source of truth for personalization.

### Quick usage

\`\`\`typescript
import { createResolver, parseLedger } from '@nomark-ai/engine'
import * as fs from 'fs'

const ledger = fs.readFileSync('./nomark-ledger.jsonl', 'utf8')
const resolver = createResolver({ ledgerContent: ledger, context: 'code' })
const result = resolver.resolveAll()

for (const [dim, res] of Object.entries(result.dimensions)) {
  if (res.winner && !res.unstable) {
    // Use this preference
    console.log(\`\${dim}: \${res.winner.target}\`)
  } else if (res.unstable) {
    // Not enough evidence — ask the user
    console.log(\`\${dim}: ask\`)
  }
}
\`\`\`

### Scoring (5 factors)
Score = Specificity(0.30) + Evidence(0.25) + Recency(0.20) + Stability(0.15) + Portability(0.10) - contradiction_penalty
- Score < 0.4 = unstable → recommend asking rather than assuming
- Scope matching: \`*\` (global), \`context:code\`, \`topic:auth\`, or compound \`context:code+topic:auth\`

### Importing signals
\`\`\`bash
npx nomark import --platform chatgpt --file export.json
npx nomark import --platform claude --file export.json
npx nomark profile   # view resolved preferences
npx nomark review    # confirm low-confidence signals
\`\`\`

### Rules
- Never modify scoring formulas without owner approval (patented)
- Never change the JSONL ledger format (compatibility contract)
- Ledger entries are capacity-bounded — pruning evicts lowest-utility entries`

function printBanner(): void {
  console.log()
  console.log(`${BOLD}  nomark-engine${RESET} ${DIM}— preference resolver setup${RESET}`)
  console.log()
}

function detectProject(dir: string): { hasPackageJson: boolean; name: string } {
  const pkgPath = path.join(dir, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      return { hasPackageJson: true, name: pkg.name ?? path.basename(dir) }
    } catch {
      return { hasPackageJson: true, name: path.basename(dir) }
    }
  }
  return { hasPackageJson: false, name: path.basename(dir) }
}

function createLedger(dir: string): 'created' | 'exists' {
  const ledgerPath = path.join(dir, LEDGER_FILE)
  if (fs.existsSync(ledgerPath)) {
    return 'exists'
  }
  fs.writeFileSync(ledgerPath, seedLedger(), 'utf8')
  return 'created'
}

function writeAIContext(dir: string): string {
  const candidates = [
    '.claude/CLAUDE.md',
    'CLAUDE.md',
    '.cursor/rules',
    '.github/copilot-instructions.md',
  ]

  for (const rel of candidates) {
    const full = path.join(dir, rel)
    if (fs.existsSync(full)) {
      const existing = fs.readFileSync(full, 'utf8')
      if (existing.includes('nomark-engine')) {
        return `already in ${rel}`
      }
      fs.appendFileSync(full, '\n\n' + AI_CONTEXT + '\n', 'utf8')
      return rel
    }
  }

  return 'none'
}

function printQuickStart(project: { hasPackageJson: boolean; name: string }): void {
  console.log(`${BOLD}  Quick start${RESET}`)
  console.log()

  if (project.hasPackageJson) {
    console.log(`${DIM}  1.${RESET} Install the engine:`)
    console.log(`     ${CYAN}npm install @nomark-ai/engine${RESET}`)
  } else {
    console.log(`${DIM}  1.${RESET} Initialize your project, then install:`)
    console.log(`     ${CYAN}npm init -y && npm install @nomark-ai/engine${RESET}`)
  }

  console.log()
  console.log(`${DIM}  2.${RESET} Import your AI history to build your ledger:`)
  console.log(`     ${CYAN}npx nomark import --platform chatgpt --file export.json${RESET}`)
  console.log()
  console.log(`${DIM}  3.${RESET} View your resolved preference profile:`)
  console.log(`     ${CYAN}npx nomark profile${RESET}`)
  console.log()
  console.log(`${DIM}  4.${RESET} Use in code:`)
  console.log()
  console.log(`${DIM}     import { createResolver } from '@nomark-ai/engine'${RESET}`)
  console.log(`${DIM}     import * as fs from 'fs'${RESET}`)
  console.log()
  console.log(`${DIM}     const ledger = fs.readFileSync('./nomark-ledger.jsonl', 'utf8')${RESET}`)
  console.log(`${DIM}     const resolver = createResolver({ ledgerContent: ledger })${RESET}`)
  console.log(`${DIM}     const result = resolver.resolveAll()${RESET}`)
  console.log()
}

function main(): void {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printBanner()
    console.log(`  Usage: ${CYAN}npx nomark-engine${RESET} [options]`)
    console.log()
    console.log('  Options:')
    console.log('    --context-only   Print AI context block to stdout (for piping)')
    console.log('    --no-ledger      Skip ledger creation')
    console.log('    --help           Show this help')
    console.log()
    return
  }

  if (args.includes('--context-only')) {
    process.stdout.write(AI_CONTEXT + '\n')
    return
  }

  const dir = process.cwd()
  const project = detectProject(dir)
  const skipLedger = args.includes('--no-ledger')

  printBanner()

  // Step 1: Create ledger
  if (!skipLedger) {
    const ledgerResult = createLedger(dir)
    if (ledgerResult === 'created') {
      console.log(`  ${GREEN}+${RESET} Created ${BOLD}${LEDGER_FILE}${RESET} ${DIM}(seed meta entry)${RESET}`)
    } else {
      console.log(`  ${DIM}-${RESET} ${LEDGER_FILE} already exists ${DIM}(skipped)${RESET}`)
    }
  }

  // Step 2: Write AI context to existing config
  const contextTarget = writeAIContext(dir)
  if (contextTarget === 'none') {
    console.log(`  ${YELLOW}!${RESET} No AI config found ${DIM}(CLAUDE.md, .cursor/rules, etc.)${RESET}`)
    console.log(`    ${DIM}Run ${CYAN}npx nomark-engine --context-only >> CLAUDE.md${RESET} ${DIM}to add manually${RESET}`)
  } else if (contextTarget.startsWith('already')) {
    console.log(`  ${DIM}-${RESET} AI context ${contextTarget} ${DIM}(skipped)${RESET}`)
  } else {
    console.log(`  ${GREEN}+${RESET} Appended AI context to ${BOLD}${contextTarget}${RESET}`)
  }

  // Step 3: Add ledger to .gitignore if not present
  const gitignorePath = path.join(dir, '.gitignore')
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8')
    if (!gitignore.includes(LEDGER_FILE)) {
      fs.appendFileSync(gitignorePath, `\n# nomark preference ledger (contains personal signals)\n${LEDGER_FILE}\n`, 'utf8')
      console.log(`  ${GREEN}+${RESET} Added ${BOLD}${LEDGER_FILE}${RESET} to .gitignore`)
    }
  }

  console.log()
  printQuickStart(project)

  console.log(`${DIM}  Docs: https://github.com/nomark-dev/nomark-sdk${RESET}`)
  console.log()
}

main()
