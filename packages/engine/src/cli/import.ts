import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseChatGPTExport } from '../importers/chatgpt.js'
import { parseClaudeExport } from '../importers/claude.js'
import { runMigration } from '../importers/pipeline.js'
import { writeLedger, parseLedger } from '../ledger.js'
import type { Conversation } from '../importers/types.js'
import { requireFlag } from './args.js'
import { loadApiKey } from './auth.js'
import { cloudImport } from './http.js'

const DEFAULT_LEDGER = './nomark-ledger.jsonl'

export async function importCommand(flags: Record<string, string | boolean>): Promise<void> {
  const platform = requireFlag(flags, 'platform')
  const filePath = requireFlag(flags, 'file')
  const ledgerPath = typeof flags['ledger'] === 'string' ? flags['ledger'] : DEFAULT_LEDGER
  const maxConversations = typeof flags['max'] === 'string' ? parseInt(flags['max'], 10) : undefined

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf8')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error(`Invalid JSON in ${filePath}: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
    return
  }

  const apiKey = loadApiKey()

  if (apiKey) {
    // Cloud mode: POST to edge function
    let result
    try {
      result = await cloudImport(apiKey, platform, parsed)
    } catch (err) {
      console.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
      return
    }
    console.log()
    console.log(`Import complete.`)
    console.log(`  Platform: ${result.platform}`)
    console.log(`  Conversations analyzed: ${result.conversationsAnalyzed}`)
    console.log(`  Signals extracted: ${result.signalsExtracted}`)
    console.log(`  Signals promoted: ${result.signalsPromoted}`)
    console.log(`  By confidence: ${result.byConfidence.high} high, ${result.byConfidence.medium} medium, ${result.byConfidence.low} low`)
    console.log()
    return
  }

  // Local mode: use parsers
  const dryRun = flags['dry-run'] === true || flags['dry-run'] === 'true'

  const parsers: Record<string, (data: string) => Conversation[]> = {
    chatgpt: parseChatGPTExport,
    claude: parseClaudeExport,
  }

  const parser = parsers[platform]
  if (!parser) {
    if (platform === 'gemini') {
      console.error(
        'Gemini imports require a NOMARK account. Run `nomark login` to authenticate, then retry.'
      )
    } else {
      console.error(`Unsupported platform: ${platform}. Supported: chatgpt, claude`)
    }
    process.exit(1)
    return
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

  const report = runMigration(conversations, {
    existingLedger: existingLedger || undefined,
    dryRun,
    maxConversations,
  })

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
    const existingEntries = existingLedger ? parseLedger(existingLedger) : []
    const allEntries = [...existingEntries, ...report.ledgerEntries]
    const content = writeLedger(allEntries)
    fs.mkdirSync(path.dirname(path.resolve(ledgerPath)), { recursive: true })
    fs.writeFileSync(ledgerPath, content)
    console.log(`  Written to ${ledgerPath}`)
  }

  console.log()
}
