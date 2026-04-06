import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseChatGPTExport } from '../importers/chatgpt.js'
import { parseClaudeExport } from '../importers/claude.js'
import { runMigration } from '../importers/pipeline.js'
import { writeLedger, parseLedger } from '../ledger.js'
import type { Conversation } from '../importers/types.js'
import { requireFlag } from './args.js'

const DEFAULT_LEDGER = './nomark-ledger.jsonl'

export function importCommand(flags: Record<string, string | boolean>): void {
  const platform = requireFlag(flags, 'platform')
  const filePath = requireFlag(flags, 'file')
  const dryRun = flags['dry-run'] !== false && flags['dry-run'] !== 'false'
  const ledgerPath = typeof flags['ledger'] === 'string' ? flags['ledger'] : DEFAULT_LEDGER
  const maxConversations = typeof flags['max'] === 'string' ? parseInt(flags['max'], 10) : undefined

  // Read file
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf8')

  const parsers: Record<string, (data: string) => Conversation[]> = {
    chatgpt: parseChatGPTExport,
    claude: parseClaudeExport,
  }

  const parser = parsers[platform]
  if (!parser) {
    console.error(`Unsupported platform: ${platform}. Supported: chatgpt, claude`)
    process.exit(1)
    return // unreachable but satisfies TS
  }

  const conversations = parser(raw)

  if (conversations.length === 0) {
    console.log('No conversations found in export file.')
    return
  }

  // Load existing ledger for dedup
  let existingLedger = ''
  if (fs.existsSync(ledgerPath)) {
    existingLedger = fs.readFileSync(ledgerPath, 'utf8')
  }

  // Run pipeline
  const report = runMigration(conversations, {
    existingLedger: existingLedger || undefined,
    dryRun,
    maxConversations,
  })

  // Display report
  console.log()
  console.log(`  Analyzing ${report.conversationsAnalyzed} conversations...`)
  console.log(`  Extracted ${report.signalsExtracted} signals (${report.byConfidence.high} high, ${report.byConfidence.medium} medium, ${report.byConfidence.low} low confidence)`)
  console.log(`  Promoted ${report.signalsPromoted} to ledger.`)

  if (report.byConfidence.low > 0) {
    console.log(`  ${report.byConfidence.low} need review. Run: npx nomark review`)
  }

  if (dryRun) {
    console.log()
    console.log('  [DRY RUN] No changes written. Run with --dry-run=false to apply.')
  } else {
    // Write ledger
    const existingEntries = existingLedger ? parseLedger(existingLedger) : []
    const allEntries = [...existingEntries, ...report.ledgerEntries]
    const content = writeLedger(allEntries)
    fs.mkdirSync(path.dirname(path.resolve(ledgerPath)), { recursive: true })
    fs.writeFileSync(ledgerPath, content)
    console.log(`  Written to ${ledgerPath}`)
  }

  console.log('  No account needed. Everything runs locally.')
  console.log()
}
