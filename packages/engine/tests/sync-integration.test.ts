import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from './helpers/mock-supabase.js'
import { createSyncClient, type SyncClient } from '../src/sync/client.js'
import { createAuthClient } from '../src/sync/auth.js'
import type { LedgerEntry } from '../src/schema.js'

let mockSupabase: ReturnType<typeof createMockSupabase>

vi.mock('../src/sync/supabase-loader.js', () => ({
  loadSupabase: () => ({
    createClient: () => mockSupabase.client,
  }),
}))

const mkPref = (dim: string, w = 0.9): LedgerEntry => ({
  type: 'pref',
  data: { dim, target: 'direct', w, n: 10, src: { code: 5 }, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' },
})

const mkRub = (): LedgerEntry => ({
  type: 'rub',
  data: { id: 'rub-1', fmt: 'email', stage: 'pending', uses: 5, accepts: 3, avg_ed: 0.2, dims: { tone: 0.8 }, min: 0.5, last: '2026-04-06' },
})

describe('Full sync roundtrip', () => {
  let client: SyncClient

  beforeEach(() => {
    mockSupabase = createMockSupabase()
    client = createSyncClient({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      userId: 'usr_test',
    })
  })

  it('push filters non-syncable entries (rub type excluded)', async () => {
    const entries = [mkPref('tone'), mkPref('length'), mkRub(), mkRub(), mkPref('format')]
    const result = await client.push(entries)
    expect(result.synced).toBe(3) // 3 prefs synced
    expect(result.filtered).toBe(2) // 2 rubs filtered
    expect(mockSupabase.getRows('ledger_entries')).toHaveLength(3)
  })

  it('push then pull returns synced entries', async () => {
    await client.push([mkPref('tone'), mkPref('length')])
    const pulled = await client.pull()
    expect(pulled).toHaveLength(2)
  })

  it('conflict resolution: archive wins', async () => {
    // Push local with w=0.7
    await client.push([mkPref('tone', 0.7)])

    // Inject a "server-side" entry with w=0.95 (simulating archive consolidation)
    const existing = mockSupabase.getRows('ledger_entries')[0]
    existing.data = { ...existing.data, w: 0.95, staged: false }

    // Pull should get the archive version
    const pulled = await client.pull()
    expect(pulled).toHaveLength(1)
    expect((pulled[0].data as { w: number }).w).toBe(0.95)
  })

  it('offline queue: disconnect → enqueue → reconnect → flush', async () => {
    client.disconnect()
    expect(client.status().connected).toBe(false)

    await client.push([mkPref('tone')])
    await client.push([mkPref('length')])

    expect(client.status().pending_ops).toBe(2)
    expect(mockSupabase.getRows('ledger_entries')).toHaveLength(0) // nothing synced yet

    const flushed: unknown[] = []
    client.on('sync:flushed', (data) => flushed.push(data))

    await client.reconnect()

    expect(client.status().connected).toBe(true)
    expect(client.status().pending_ops).toBe(0)
    expect(flushed).toHaveLength(1)
    expect(mockSupabase.getRows('ledger_entries')).toHaveLength(2) // now synced
  })

  it('auth integration: signIn and getSession', async () => {
    const auth = createAuthClient({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
    })

    const signInResult = await auth.signIn('test@test.com')
    expect(signInResult.error).toBeNull()

    const session = await auth.getSession()
    expect(session?.user.id).toBe('usr_test')
    expect(session?.user.email).toBe('test@test.com')
  })

  it('realtime: subscribe receives pushed entries', async () => {
    const received: LedgerEntry[][] = []
    client.subscribe((entries) => received.push(entries))

    // Simulate a realtime event
    mockSupabase.fireRealtime({
      id: 'row-rt-1',
      user_id: 'usr_test',
      signal_type: 'pref',
      dim_key: 'pref:audience:*',
      scope: '*',
      data: { dim: 'audience', target: 'devs' },
      sync_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    expect(received).toHaveLength(1)
    expect(received[0][0].type).toBe('pref')
  })
})
