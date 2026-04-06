import type { LedgerEntry } from '../schema.js'

export type RealtimeConfig = {
  db: RealtimeDb
  userId: string
}

export function createRealtimeSubscription(
  config: RealtimeConfig,
  callback: (entries: LedgerEntry[]) => void
): () => void {
  const db = config.db as RealtimeDb
  const channel = db.channel(`ledger-realtime-${config.userId}`)

  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'ledger_entries',
      filter: `user_id=eq.${config.userId}`,
    },
    (payload: { new: { signal_type: string; data: unknown } }) => {
      const entry = {
        type: payload.new.signal_type,
        data: payload.new.data,
      } as LedgerEntry
      callback([entry])
    }
  )

  return () => {
    db.removeChannel(channel)
  }
}

type RealtimeDb = {
  channel: (name: string) => {
    on: (event: string, config: unknown, callback: (payload: { new: { signal_type: string; data: unknown } }) => void) => { subscribe: () => { unsubscribe: () => void } }
  }
  removeChannel: (channel: unknown) => void
}
