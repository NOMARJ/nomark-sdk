import { loadApiKey } from './auth.js'
import { probeAuth } from './http.js'

export async function whoamiCommand(): Promise<void> {
  const key = loadApiKey()
  if (!key) {
    console.error('Not authenticated. Run `nomark login`.')
    process.exit(1)
  }
  const result = await probeAuth(key)
  if (!result.authenticated) {
    console.error('Not authenticated. Run `nomark login`.')
    process.exit(1)
  }
  if (result.uid) {
    console.log(result.uid)
  } else if (result.email) {
    console.log(result.email)
  } else {
    console.log(`Authenticated (key: ...${key.slice(-4)})`)
  }
}
