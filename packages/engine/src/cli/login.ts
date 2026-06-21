import * as readline from 'node:readline'
import { saveApiKey } from './auth.js'
import { probeAuth } from './http.js'

export async function loginCommand(): Promise<void> {
  const envKey = process.env['NOMARK_TOKEN']
  if (envKey) {
    const result = await probeAuth(envKey)
    if (!result.authenticated) {
      console.error('Error: NOMARK_TOKEN is not valid (401 Unauthorized)')
      process.exit(1)
    }
    saveApiKey(envKey)
    console.log('Logged in successfully.')
    if (result.uid) console.log(`  User: ${result.uid}`)
    if (result.email) console.log(`  Email: ${result.email}`)
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  const key = await new Promise<string>((resolve) => {
    rl.question('Enter your NOMARK API key (nomark_sk_...): ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
  if (!key) {
    console.error('Error: No API key provided')
    process.exit(1)
  }
  const result = await probeAuth(key)
  if (!result.authenticated) {
    console.error('Error: API key is not valid (401 Unauthorized)')
    process.exit(1)
  }
  saveApiKey(key)
  console.log('Logged in successfully. API key saved to ~/.nomark/config.json')
  if (result.uid) console.log(`  User: ${result.uid}`)
  if (result.email) console.log(`  Email: ${result.email}`)
}
