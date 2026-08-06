import * as readline from 'node:readline'
import { saveConfig } from './config.js'

const PROCESS_IMPORT_URL = 'https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import'

async function validateToken(token: string): Promise<boolean> {
  const response = await fetch(PROCESS_IMPORT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ platform: 'chatgpt', data: [] }),
  })
  return response.status !== 401
}

function promptApiKey(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question('Enter your NOMARK API key (nomark_sk_...): ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export async function loginCommand(): Promise<void> {
  const token = process.env['NOMARK_TOKEN'] ?? (await promptApiKey())

  if (!token) {
    console.error('Error: No API key provided.')
    process.exit(1)
  }

  if (!token.startsWith('nomark_sk_')) {
    console.error('Error: Invalid API key format. Expected key starting with nomark_sk_')
    process.exit(1)
  }

  console.log('Validating API key...')

  let valid: boolean
  try {
    valid = await validateToken(token)
  } catch {
    console.error('Error: Could not reach NOMARK API. Check your network connection.')
    process.exit(1)
    return
  }

  if (!valid) {
    console.error('Error: Invalid API key (401). Check your key in the NOMARK panel under Settings → API Keys.')
    process.exit(1)
  }

  saveConfig({ token })
  console.log('Authenticated successfully.')
  console.log(`API key saved to ~/.nomark/config.json (key: ***${token.slice(-4)})`)
}
