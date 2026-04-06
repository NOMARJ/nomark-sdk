import { describe, it, expect, vi } from 'vitest'

describe('lazy Supabase import', () => {
  it('importing @nomark-ai/engine does not throw when Supabase is not installed', async () => {
    // The main index re-exports sync types and functions — this should not throw
    const mod = await import('../src/index.js')
    expect(mod.createSyncClient).toBeDefined()
    expect(typeof mod.createSyncClient).toBe('function')
  })

  it('createSyncClient throws descriptive error when Supabase is unavailable', async () => {
    // Reset the mock to simulate missing module
    vi.doMock('../src/sync/supabase-loader.js', () => ({
      loadSupabase: () => {
        throw new Error(
          '@supabase/supabase-js is required for sync features. Install it: npm install @supabase/supabase-js'
        )
      },
    }))

    const { createSyncClient } = await import('../src/sync/client.js')
    expect(() =>
      createSyncClient({
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'key',
        userId: 'usr',
      })
    ).toThrow('@supabase/supabase-js is required')

    vi.restoreAllMocks()
  })
})
