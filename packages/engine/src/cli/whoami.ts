import { loadApiKey } from './config.js'

const PROCESS_IMPORT_URL =
  'https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import'

export async function whoamiCommand(): Promise<void> {
  const apiKey = loadApiKey()

  if (!apiKey) {
    console.error('Not authenticated. Run `nomark login`.')
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
      body: JSON.stringify({ platform: 'chatgpt', data: [] }),
    })
  } catch {
    console.error('Not authenticated. Run `nomark login`.')
    process.exit(1)
  }

  if (res.status === 401 || res.status === 403) {
    console.error('Not authenticated. Run `nomark login`.')
    process.exit(1)
  }

  console.log('Authenticated')
}
