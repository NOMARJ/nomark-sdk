import * as fs from 'node:fs'
import { loadConfig } from './config.js'
import { requireFlag } from './args.js'

const PROCESS_IMPORT_URL = 'https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import'

type Platform = 'chatgpt' | 'claude' | 'gemini'

const SUPPORTED_PLATFORMS: Platform[] = ['chatgpt', 'claude', 'gemini']

type ImportResult = {
  platform: string
  conversationsAnalyzed: number
  signalsExtracted: number
  signalsPromoted: number
  byConfidence: {
    high: number
    medium: number
    low: number
  }
}

export async function importCommand(flags: Record<string, string | boolean>): Promise<void> {
  const platform = requireFlag(flags, 'platform') as Platform
  const filePath = requireFlag(flags, 'file')

  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    console.error(`Unsupported platform: ${platform}. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`)
    process.exit(1)
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch {
    console.error(`Error: Could not read file: ${filePath}`)
    process.exit(1)
    return
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    console.error(`Error: Invalid JSON in file: ${filePath}`)
    process.exit(1)
    return
  }

  const config = loadConfig()
  const token = config.token

  if (!token) {
    console.error('Not authenticated. Run `nomark login` first.')
    process.exit(1)
  }

  let response: Response
  try {
    response = await fetch(PROCESS_IMPORT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform, data }),
    })
  } catch {
    console.error('Error: Could not reach NOMARK API. Check your network connection.')
    process.exit(1)
    return
  }

  if (!response.ok) {
    let body = ''
    try {
      body = await response.text()
    } catch {
      // ignore read failure
    }
    if (response.status === 401) {
      console.error('Error: Authentication failed (401). Run `nomark login` to re-authenticate.')
    } else {
      console.error(`Error: API request failed (${response.status}): ${body}`)
    }
    process.exit(1)
    return
  }

  let result: ImportResult
  try {
    result = (await response.json()) as ImportResult
  } catch {
    console.error('Error: Invalid response from NOMARK API.')
    process.exit(1)
    return
  }

  console.log()
  console.log(`Import complete. Platform: ${result.platform}.`)
  console.log(`Conversations analyzed: ${result.conversationsAnalyzed}.`)
  console.log(`Signals extracted: ${result.signalsExtracted} (${result.byConfidence.high} high, ${result.byConfidence.medium} medium, ${result.byConfidence.low} low confidence).`)
  console.log(`Signals promoted to ledger: ${result.signalsPromoted}.`)
  console.log()
}
