const EDGE_FUNCTION_URL =
  'https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import'

export type ImportResult = {
  platform: string
  conversationsAnalyzed: number
  signalsExtracted: number
  signalsPromoted: number
  byConfidence: { high: number; medium: number; low: number }
}

export type AuthProbeResult = {
  authenticated: boolean
  uid?: string
  email?: string
}

export async function cloudImport(
  apiKey: string,
  platform: string,
  data: unknown
): Promise<ImportResult> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ platform, data }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
  }
  return res.json() as Promise<ImportResult>
}

export async function probeAuth(apiKey: string): Promise<AuthProbeResult> {
  let res: Response
  try {
    res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform: 'probe', data: null }),
    })
  } catch (err) {
    throw new Error(
      `Network error: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  if (res.status === 401) return { authenticated: false }
  try {
    const body = (await res.json()) as Record<string, unknown>
    return {
      authenticated: true,
      uid: typeof body['uid'] === 'string' ? body['uid'] : undefined,
      email: typeof body['email'] === 'string' ? body['email'] : undefined,
    }
  } catch {
    return { authenticated: true }
  }
}
