import * as fs from 'node:fs'
import { loadApiKey } from './config.js'
import { requireFlag } from './args.js'

const PROCESS_IMPORT_URL =
  'https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import'

const SUPPORTED_PLATFORMS = ['chatgpt', 'claude', 'gemini'] as const

type ImportResult = {
  platform: string
  conversationsAnalyzed: number
  signalsExtracted: number
  signalsPromoted: number
  byConfidence: { high: number; medium: number; low: number }
}

export async function importCommand(flags: Record<string, string | boolean>): Promise<void> {
  const platform = requireFlag(flags, 'platform')
  const filePath = requireFlag(flags, 'file')

  if (!(SUPPORTED_PLATFORMS as readonly string[]).includes(platform)) {
    console.error(`Unsupported platform: ${platform}. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`)
    process.exit(1)
  }

  const apiKey = loadApiKey()
  if (!apiKey) {
    console.error('Not authenticated. Run `nomark login` first.')
    process.exit(1)
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  let data: unknown
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    data = JSON.parse(raw)
  } catch {
    console.error(`Failed to parse file as JSON: ${filePath}`)
    process.exit(1)
  }

  let res: Response
  try {
    res = await fetch(PROCESS_IMPORT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform, data }),
    })
  } catch {
    console.error('Network error. Check your connection and try again.')
    process.exit(1)
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      console.error('Not authenticated. Run `nomark login` to refresh your API key.')
      process.exit(1)
    }
    console.error(`Import failed (HTTP ${res.status}). Try again or contact support.`)
    process.exit(1)
  }

  let result: ImportResult
  try {
    result = (await res.json()) as ImportResult
  } catch {
    console.error('Unexpected response from server.')
    process.exit(1)
  }

  console.log()
  console.log(`  Analyzed ${result.conversationsAnalyzed} conversations from ${platform}.`)
  console.log(`  Extracted ${result.signalsExtracted} signals (${result.byConfidence.high} high, ${result.byConfidence.medium} medium, ${result.byConfidence.low} low confidence).`)
  console.log(`  Promoted ${result.signalsPromoted} to your NOMARK profile.`)
  console.log()
}
