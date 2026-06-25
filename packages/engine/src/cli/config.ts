import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

export type NomarkConfig = {
  model?: string
  api_key?: string
  ledgerPath?: string
}

const CONFIG_DIR = path.join(os.homedir(), '.nomark')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

export function loadConfig(): NomarkConfig {
  const config: NomarkConfig = {}

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Record<string, unknown>
      if (typeof raw['model'] === 'string') config.model = raw['model']
      // Support both snake_case (current) and legacy camelCase
      if (typeof raw['api_key'] === 'string') config.api_key = raw['api_key']
      else if (typeof raw['apiKey'] === 'string') config.api_key = raw['apiKey']
      if (typeof raw['ledgerPath'] === 'string') config.ledgerPath = raw['ledgerPath']
    } catch {
      // ignore malformed config
    }
  }

  // Env overrides
  if (process.env['NOMARK_MODEL']) config.model = process.env['NOMARK_MODEL']
  if (process.env['NOMARK_TOKEN']) config.api_key = process.env['NOMARK_TOKEN']

  return config
}

export function saveConfig(config: NomarkConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  const existing = loadConfig()
  const merged = { ...existing, ...config }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + '\n')
  fs.chmodSync(CONFIG_PATH, 0o600)
}

export function loadApiKey(): string | undefined {
  return process.env['NOMARK_TOKEN'] ?? loadConfig().api_key
}

export function configCommand(flags: Record<string, string | boolean>): void {
  const updates: NomarkConfig = {}

  if (typeof flags['model'] === 'string') updates.model = flags['model']
  if (typeof flags['api-key'] === 'string') updates.api_key = flags['api-key']
  if (typeof flags['ledger'] === 'string') updates.ledgerPath = flags['ledger']

  if (Object.keys(updates).length === 0) {
    const config = loadConfig()
    const display = { ...config }
    if (display.api_key) display.api_key = `***${display.api_key.slice(-4)}`
    console.log(JSON.stringify(display, null, 2))
    return
  }

  saveConfig(updates)
  console.log('Configuration saved to ~/.nomark/config.json')
  if (updates.model) console.log(`  model: ${updates.model}`)
  if (updates.api_key) console.log(`  api_key: ***${updates.api_key.slice(-4)}`)
  if (updates.ledgerPath) console.log(`  ledgerPath: ${updates.ledgerPath}`)
}
