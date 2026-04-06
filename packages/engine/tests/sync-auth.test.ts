import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthClient, type AuthClient } from '../src/sync/auth.js'

vi.mock('../src/sync/supabase-loader.js', () => ({
  loadSupabase: () => ({
    createClient: () => ({
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'usr_abc', email: 'test@test.com' } } },
          error: null,
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    }),
  }),
}))

describe('createAuthClient', () => {
  let auth: AuthClient

  beforeEach(() => {
    auth = createAuthClient({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
    })
  })

  it('returns object with signIn, signOut, getSession methods', () => {
    expect(typeof auth.signIn).toBe('function')
    expect(typeof auth.signOut).toBe('function')
    expect(typeof auth.getSession).toBe('function')
    expect(typeof auth.onAuthStateChange).toBe('function')
  })

  it('signIn calls Supabase OTP with email', async () => {
    const result = await auth.signIn('test@test.com')
    expect(result.error).toBeNull()
  })

  it('signOut calls Supabase signOut', async () => {
    const result = await auth.signOut()
    expect(result.error).toBeNull()
  })

  it('getSession returns current session', async () => {
    const session = await auth.getSession()
    expect(session?.user.id).toBe('usr_abc')
    expect(session?.user.email).toBe('test@test.com')
  })

  it('onAuthStateChange accepts callback and returns unsubscribe', () => {
    const callback = vi.fn()
    const unsub = auth.onAuthStateChange(callback)
    expect(typeof unsub).toBe('function')
  })
})
