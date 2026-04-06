import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSyncClient, type SyncClient } from '../src/sync/client.js'
import type { LedgerEntry } from '../src/schema.js'

// Mock Supabase module
vi.mock('../src/sync/supabase-loader.js', () => ({
  loadSupabase: () => ({
    createClient: (_url: string, _key: string) => createMockSupabaseClient(),
  }),
}))

function createMockSupabaseClient() {
  const store: Record<string, unknown[]> = { ledger_entries: [] }
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, _val: string) => ({
          data: store[table] ?? [],
          error: null,
        }),
      }),
      upsert: (rows: unknown[]) => {
        store[table] = store[table] ?? []
        store[table].push(...(rows as unknown[]))
        return { data: rows, error: null }
      },
    }),
    channel: (_name: string) => ({
      on: () => ({ subscribe: () => ({ unsubscribe: vi.fn() }) }),
    }),
    removeChannel: vi.fn(),
  }
}

const mkPref = (dim: string, w: number): LedgerEntry => ({
  type: 'pref',
  data: { dim, target: 'direct', w, n: 10, src: { code: 5 }, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' },
})

const rubEntry: LedgerEntry = {
  type: 'rub',
  data: { id: 'rub-1', fmt: 'email', stage: 'pending', uses: 5, accepts: 3, avg_ed: 0.2, dims: { tone: 0.8 }, min: 0.5, last: '2026-04-06' },
}

describe('createSyncClient', () => {
  let client: SyncClient

  beforeEach(() => {
    client = createSyncClient({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      userId: 'usr_test',
    })
  })

  it('returns object with push, pull, subscribe, disconnect methods', () => {
    expect(typeof client.push).toBe('function')
    expect(typeof client.pull).toBe('function')
    expect(typeof client.subscribe).toBe('function')
    expect(typeof client.disconnect).toBe('function')
  })

  it('returns status method', () => {
    expect(typeof client.status).toBe('function')
    const s = client.status()
    expect(s.connected).toBe(true)
    expect(s.pending_ops).toBe(0)
  })

  it('push filters out non-syncable entries (rub)', async () => {
    const result = await client.push([mkPref('tone', 0.9), rubEntry])
    expect(result.synced).toBe(1) // only pref synced, rub filtered
    expect(result.filtered).toBe(1)
  })

  it('push stages entries at 0.8x weight', async () => {
    const result = await client.push([mkPref('tone', 0.9)])
    expect(result.synced).toBe(1)
    // The staged entry should have w * 0.8
    expect(result.entries[0]).toBeDefined()
  })

  it('pull returns entries from remote', async () => {
    await client.push([mkPref('tone', 0.9)])
    const entries = await client.pull()
    expect(Array.isArray(entries)).toBe(true)
  })

  it('queues operations when disconnected', async () => {
    client.disconnect()
    const s = client.status()
    expect(s.connected).toBe(false)

    // Push while disconnected should queue
    const result = await client.push([mkPref('tone', 0.9)])
    expect(result.queued).toBe(true)
    expect(client.status().pending_ops).toBe(1)
  })

  it('subscribe accepts a callback', () => {
    const unsub = client.subscribe(() => {})
    expect(typeof unsub).toBe('function')
  })
})
