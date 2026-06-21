import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cloudImport, probeAuth } from '../../src/cli/http.js'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cloudImport', () => {
  it('POSTs to the edge function with correct headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        platform: 'chatgpt',
        conversationsAnalyzed: 3,
        signalsExtracted: 10,
        signalsPromoted: 5,
        byConfidence: { high: 2, medium: 3, low: 5 },
      }),
    })

    await cloudImport('nomark_sk_test', 'chatgpt', [{ id: 1 }])

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer nomark_sk_test')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('sends platform and data in request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        platform: 'claude',
        conversationsAnalyzed: 1,
        signalsExtracted: 2,
        signalsPromoted: 1,
        byConfidence: { high: 1, medium: 1, low: 0 },
      }),
    })

    const data = { conversations: [{ title: 'test' }] }
    await cloudImport('nomark_sk_test', 'claude', data)

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['platform']).toBe('claude')
    expect(body['data']).toEqual(data)
  })

  it('returns ImportResult on success', async () => {
    const expected = {
      platform: 'chatgpt',
      conversationsAnalyzed: 5,
      signalsExtracted: 20,
      signalsPromoted: 10,
      byConfidence: { high: 4, medium: 6, low: 10 },
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => expected,
    })

    const result = await cloudImport('nomark_sk_test', 'chatgpt', [])
    expect(result).toEqual(expected)
  })

  it('throws with HTTP status and body on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })

    await expect(cloudImport('nomark_sk_bad', 'chatgpt', [])).rejects.toThrow('HTTP 401')
  })

  it('throws with 500 error body on server error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    await expect(cloudImport('nomark_sk_test', 'chatgpt', [])).rejects.toThrow('HTTP 500')
  })

  it('does not include api_key in request body (credential isolation)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        platform: 'chatgpt',
        conversationsAnalyzed: 0,
        signalsExtracted: 0,
        signalsPromoted: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
      }),
    })

    await cloudImport('nomark_sk_secret', 'chatgpt', [])

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = init.body as string
    expect(body).not.toContain('nomark_sk_secret')
  })
})

describe('probeAuth', () => {
  it('returns authenticated: false on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 401,
      json: async () => ({}),
    })

    const result = await probeAuth('nomark_sk_bad')
    expect(result.authenticated).toBe(false)
  })

  it('returns authenticated: true on non-401 response', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({}),
    })

    const result = await probeAuth('nomark_sk_valid')
    expect(result.authenticated).toBe(true)
  })

  it('returns uid and email from response body when present', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ uid: 'abc-123', email: 'user@example.com' }),
    })

    const result = await probeAuth('nomark_sk_valid')
    expect(result.authenticated).toBe(true)
    expect(result.uid).toBe('abc-123')
    expect(result.email).toBe('user@example.com')
  })

  it('returns authenticated: true even if response body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => { throw new Error('not json') },
    })

    const result = await probeAuth('nomark_sk_valid')
    expect(result.authenticated).toBe(true)
    expect(result.uid).toBeUndefined()
  })

  it('throws on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network failure'))
    await expect(probeAuth('nomark_sk_test')).rejects.toThrow('Network error')
  })

  it('POSTs probe payload to edge function', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({}),
    })

    await probeAuth('nomark_sk_test')

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import')
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['platform']).toBe('probe')
    expect(body['data']).toBeNull()
  })
})
