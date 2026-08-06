import { loadConfig } from './config.js'

const PROCESS_IMPORT_URL = 'https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import'

export async function whoamiCommand(): Promise<void> {
  const config = loadConfig()
  const token = config.token

  if (!token) {
    console.error('Not authenticated. Run `nomark login`.')
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
      body: JSON.stringify({ platform: 'chatgpt', data: [] }),
    })
  } catch {
    console.error('Error: Could not reach NOMARK API. Check your network connection.')
    process.exit(1)
    return
  }

  if (response.status === 401) {
    console.error('Error: API key is invalid or revoked (401). Run `nomark login` to re-authenticate.')
    process.exit(1)
  }

  console.log(`Authenticated. API key: ***${token.slice(-4)}`)
}
