import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

export type NomarkConfig = {
  model?: string
  apiKey?: string
  ledgerPath?: string
  token?: string
}

function getConfigDir(): string {
  return path.join(os.homedir(), '.nomark')
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json')
}

export function loadConfig(): NomarkConfig {
  const config: NomarkConfig = {}
  const configPath = getConfigPath()

  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
      if (typeof raw['model'] === 'string') config.model = raw['model']
      if (typeof raw['apiKey'] === 'string') config.apiKey = raw['apiKey']
      if (typeof raw['ledgerPath'] === 'string') config.ledgerPath = raw['ledgerPath']
      if (typeof raw['api_key'] === 'string') config.token = raw['api_key']
    } catch {
      // ignore malformed config
    }
  }

  if (process.env['NOMARK_MODEL']) config.model = process.env['NOMARK_MODEL']
  if (process.env['NOMARK_API_KEY']) config.apiKey = process.env['NOMARK_API_KEY']
  if (process.env['NOMARK_TOKEN']) config.token = process.env['NOMARK_TOKEN']

  return config
}

export function saveConfig(config: NomarkConfig): void {
  const configDir = getConfigDir()
  const configPath = getConfigPath()
  fs.mkdirSync(configDir, { recursive: true })
  const existing = loadConfig()
  const merged = { ...existing, ...config }

  const json: Record<string, unknown> = {}
  if (merged.model !== undefined) json['model'] = merged.model
  if (merged.apiKey !== undefined) json['apiKey'] = merged.apiKey
  if (merged.ledgerPath !== undefined) json['ledgerPath'] = merged.ledgerPath
  if (merged.token !== undefined) json['api_key'] = merged.token

  fs.writeFileSync(configPath, JSON.stringify(json, null, 2) + '\n')
  fs.chmodSync(configPath, 0o600)
}

export function configCommand(flags: Record<string, string | boolean>): void {
  const updates: NomarkConfig = {}

  if (typeof flags['model'] === 'string') updates.model = flags['model']
  if (typeof flags['api-key'] === 'string') updates.apiKey = flags['api-key']
  if (typeof flags['ledger'] === 'string') updates.ledgerPath = flags['ledger']

  if (Object.keys(updates).length === 0) {
    const config = loadConfig()
    const display: Record<string, unknown> = {}
    if (config.model !== undefined) display['model'] = config.model
    if (config.apiKey !== undefined) display['apiKey'] = `***${config.apiKey.slice(-4)}`
    if (config.ledgerPath !== undefined) display['ledgerPath'] = config.ledgerPath
    if (config.token !== undefined) display['api_key'] = `***${config.token.slice(-4)}`
    console.log(JSON.stringify(display, null, 2))
    return
  }

  saveConfig(updates)
  console.log('Configuration saved to ~/.nomark/config.json')
  if (updates.model) console.log(`  model: ${updates.model}`)
  if (updates.apiKey) console.log(`  apiKey: ***${updates.apiKey.slice(-4)}`)
  if (updates.ledgerPath) console.log(`  ledgerPath: ${updates.ledgerPath}`)
}
