import * as readline from 'node:readline'
import { saveConfig } from './config.js'

async function promptApiKey(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question('Enter your NOMARK API key (nomark_sk_...): ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export async function loginCommand(): Promise<void> {
  let key = process.env['NOMARK_TOKEN']

  if (!key) {
    key = await promptApiKey()
  }

  if (!key.startsWith('nomark_sk_')) {
    console.error('Invalid API key format. Key must start with nomark_sk_')
    process.exit(1)
  }

  saveConfig({ api_key: key })
  console.log(`API key saved. Logged in as ***${key.slice(-5)}`)
}
