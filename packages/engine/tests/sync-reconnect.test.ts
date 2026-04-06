import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSyncClient, type SyncClient } from '../src/sync/client.js'
import type { LedgerEntry } from '../src/schema.js'

vi.mock('../src/sync/supabase-loader.js', () => ({
  loadSupabase: () => ({
    createClient: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ data: [], error: null }) }),
        upsert: (rows: unknown[]) => ({ data: rows, error: null }),
      }),
      channel: () => ({
        on: () => ({ subscribe: () => ({ unsubscribe: vi.fn() }) }),
      }),
      removeChannel: vi.fn(),
    }),
  }),
}))

const mkPref = (dim: string): LedgerEntry => ({
  type: 'pref',
  data: { dim, target: 'direct', w: 0.9, n: 10, src: { code: 5 }, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' },
})

describe('SyncClient reconnect-and-flush', () => {
  let client: SyncClient

  beforeEach(() => {
    client = createSyncClient({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      userId: 'usr_test',
    })
  })

  it('queues ops when disconnected then flushes on reconnect', async () => {
    client.disconnect()

    await client.push([mkPref('tone')])
    await client.push([mkPref('length')])
    await client.push([mkPref('format')])

    expect(client.status().pending_ops).toBe(3)

    const flushedEvents: unknown[] = []
    client.on('sync:flushed', (data) => flushedEvents.push(data))

    await client.reconnect()

    expect(client.status().connected).toBe(true)
    expect(client.status().pending_ops).toBe(0)
    expect(flushedEvents).toHaveLength(1)
    expect((flushedEvents[0] as { count: number }).count).toBe(3)
  })

  it('reconnect with empty queue does not emit flushed event', async () => {
    client.disconnect()

    const flushedEvents: unknown[] = []
    client.on('sync:flushed', (data) => flushedEvents.push(data))

    await client.reconnect()

    expect(flushedEvents).toHaveLength(0)
  })

  it('status reflects connected state after reconnect', async () => {
    client.disconnect()
    expect(client.status().connected).toBe(false)

    await client.reconnect()
    expect(client.status().connected).toBe(true)
  })
})
