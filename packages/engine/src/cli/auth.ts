import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

function getConfigDir(): string {
  return path.join(os.homedir(), '.nomark')
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json')
}

export function loadApiKey(): string | undefined {
  const envKey = process.env['NOMARK_TOKEN']
  if (envKey) return envKey
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) return undefined
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
    if (typeof raw['api_key'] === 'string') return raw['api_key']
  } catch {
    // malformed JSON or read error — treat as missing
  }
  return undefined
}

export function saveApiKey(key: string): void {
  const configDir = getConfigDir()
  const configPath = getConfigPath()
  fs.mkdirSync(configDir, { recursive: true })
  let existing: Record<string, unknown> = {}
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
    } catch {
      // malformed — start fresh but keep file
    }
  }
  existing['api_key'] = key
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n')
  fs.chmodSync(configPath, 0o600)
}

export function clearApiKey(): void {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) return
  try {
    const existing = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
    delete existing['api_key']
    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n')
    fs.chmodSync(configPath, 0o600)
  } catch {
    // ignore read/parse errors
  }
}
