import type { LedgerEntry } from '../schema.js'
import type { SyncConfig, SyncStatus, SyncEntry } from './types.js'
import { filterSyncable } from './privacy-filter.js'
import { stageForSync } from './protocol.js'
import { OfflineQueue } from './offline-queue.js'
import { entryKey } from './merge.js'
import { loadSupabase } from './supabase-loader.js'

export type PushResult = {
  synced: number
  filtered: number
  queued: boolean
  entries: SyncEntry[]
}

export type SyncClient = {
  push: (entries: LedgerEntry[]) => Promise<PushResult>
  pull: () => Promise<LedgerEntry[]>
  subscribe: (callback: (entries: LedgerEntry[]) => void) => () => void
  disconnect: () => void
  reconnect: () => Promise<void>
  status: () => SyncStatus
  on: (event: string, callback: (...args: unknown[]) => void) => void
}

export function createSyncClient(config: SyncConfig): SyncClient {
  const supabase = loadSupabase()
  const db = supabase.createClient(config.supabaseUrl, config.supabaseKey) as SupabaseClient
  const queue = new OfflineQueue()
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()

  let connected = true
  let lastPush: string | null = null
  let lastPull: string | null = null
  let syncVersion = 0

  function emit(event: string, ...args: unknown[]): void {
    for (const cb of listeners.get(event) ?? []) {
      cb(...args)
    }
  }

  function toSyncEntries(entries: LedgerEntry[]): SyncEntry[] {
    return entries.map(e => {
      const staged = stageForSync(e)
      return {
        ...staged,
        sync_version: ++syncVersion,
        user_id: config.userId,
        updated_at: new Date().toISOString(),
      } as SyncEntry
    })
  }

  function toDbRows(entries: SyncEntry[]) {
    return entries.map(e => ({
      user_id: config.userId,
      signal_type: e.type,
      dim_key: entryKey(e as unknown as LedgerEntry),
      scope: (e.data as Record<string, unknown>).scope ?? '*',
      data: e.data,
      sync_version: e.sync_version,
      updated_at: e.updated_at,
    }))
  }

  const client: SyncClient = {
    async push(entries: LedgerEntry[]): Promise<PushResult> {
      const syncable = filterSyncable(entries)
      const filtered = entries.length - syncable.length

      if (!connected) {
        const syncEntries = toSyncEntries(syncable)
        queue.enqueue('push', syncEntries)
        return { synced: 0, filtered, queued: true, entries: syncEntries }
      }

      const syncEntries = toSyncEntries(syncable)
      const rows = toDbRows(syncEntries)

      const result = db.from('ledger_entries').upsert(rows)
      if (result.error) {
        throw new Error(`Sync push failed: ${result.error.message}`)
      }

      lastPush = new Date().toISOString()
      return { synced: syncable.length, filtered, queued: false, entries: syncEntries }
    },

    async pull(): Promise<LedgerEntry[]> {
      if (!connected) {
        queue.enqueue('pull', [])
        return []
      }

      const result = db.from('ledger_entries').select().eq('user_id', config.userId)
      if (result.error) {
        throw new Error(`Sync pull failed: ${result.error.message}`)
      }

      lastPull = new Date().toISOString()

      const remote = ((result.data ?? []) as Array<{ signal_type: string; data: unknown }>).map((row) => ({
        type: row.signal_type,
        data: row.data,
      })) as LedgerEntry[]

      return remote
    },

    subscribe(callback: (entries: LedgerEntry[]) => void): () => void {
      const channel = db.channel('ledger-sync')
        .on('postgres_changes' as string, {
          event: 'INSERT',
          schema: 'public',
          table: 'ledger_entries',
          filter: `user_id=eq.${config.userId}`,
        } as unknown, (payload: unknown) => {
          const p = payload as { new: { signal_type: string; data: unknown } }
          const entry = { type: p.new.signal_type, data: p.new.data } as LedgerEntry
          callback([entry])
        })

      channel.subscribe()

      return () => {
        db.removeChannel(channel)
      }
    },

    disconnect(): void {
      connected = false
    },

    async reconnect(): Promise<void> {
      connected = true
      const ops = queue.flush()
      if (ops.length > 0) {
        for (const op of ops) {
          if (op.kind === 'push' && op.entries.length > 0) {
            const rows = toDbRows(op.entries)
            db.from('ledger_entries').upsert(rows)
          }
        }
        emit('sync:flushed', { count: ops.length })
      }
    },

    status(): SyncStatus {
      return {
        connected,
        last_push: lastPush,
        last_pull: lastPull,
        pending_ops: queue.pendingCount,
        sync_version: syncVersion,
      }
    },

    on(event: string, callback: (...args: unknown[]) => void): void {
      const cbs = listeners.get(event) ?? []
      cbs.push(callback)
      listeners.set(event, cbs)
    },
  }

  return client
}

// Minimal type for the Supabase client shape we use
type SupabaseClient = {
  from: (table: string) => {
    select: () => { eq: (col: string, val: string) => { data: unknown[]; error: { message: string } | null } }
    upsert: (rows: unknown[]) => { data: unknown[]; error: { message: string } | null }
  }
  channel: (name: string) => {
    on: (event: string, config: unknown, callback: (payload: unknown) => void) => { subscribe: () => { unsubscribe: () => void } }
  }
  removeChannel: (channel: unknown) => void
}
