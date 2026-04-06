import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

export type NomarkConfig = {
  model?: string
  apiKey?: string
  ledgerPath?: string
}

const CONFIG_DIR = path.join(os.homedir(), '.nomark')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

export function loadConfig(): NomarkConfig {
  const config: NomarkConfig = {}

  // File config
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Record<string, unknown>
      if (typeof raw['model'] === 'string') config.model = raw['model']
      if (typeof raw['apiKey'] === 'string') config.apiKey = raw['apiKey']
      if (typeof raw['ledgerPath'] === 'string') config.ledgerPath = raw['ledgerPath']
    } catch {
      // ignore malformed config
    }
  }

  // Env overrides
  if (process.env['NOMARK_MODEL']) config.model = process.env['NOMARK_MODEL']
  if (process.env['NOMARK_API_KEY']) config.apiKey = process.env['NOMARK_API_KEY']

  return config
}

export function saveConfig(config: NomarkConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  const existing = loadConfig()
  const merged = { ...existing, ...config }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + '\n')
}

export function configCommand(flags: Record<string, string | boolean>): void {
  const updates: NomarkConfig = {}

  if (typeof flags['model'] === 'string') updates.model = flags['model']
  if (typeof flags['api-key'] === 'string') updates.apiKey = flags['api-key']
  if (typeof flags['ledger'] === 'string') updates.ledgerPath = flags['ledger']

  if (Object.keys(updates).length === 0) {
    // Show current config
    const config = loadConfig()
    console.log(JSON.stringify(config, null, 2))
    return
  }

  saveConfig(updates)
  console.log('Configuration saved to ~/.nomark/config.json')
  if (updates.model) console.log(`  model: ${updates.model}`)
  if (updates.apiKey) console.log(`  apiKey: ***${updates.apiKey.slice(-4)}`)
  if (updates.ledgerPath) console.log(`  ledgerPath: ${updates.ledgerPath}`)
}
