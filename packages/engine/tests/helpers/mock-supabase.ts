import { vi } from 'vitest'

export type MockRow = {
  id: string
  user_id: string
  signal_type: string
  dim_key: string
  scope: string
  data: Record<string, unknown>
  sync_version: number
  created_at: string
  updated_at: string
}

export function createMockSupabase() {
  const store: Record<string, MockRow[]> = {
    ledger_entries: [],
  }

  const realtimeCallbacks: Array<(payload: { new: MockRow }) => void> = []

  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: string) => ({
          data: (store[table] ?? []).filter(
            (r: Record<string, unknown>) => r[col] === val
          ),
          error: null,
        }),
      }),
      upsert: (rows: MockRow[]) => {
        store[table] = store[table] ?? []
        for (const row of rows) {
          const existing = store[table].findIndex(
            (r) => r.dim_key === row.dim_key && r.user_id === row.user_id
          )
          if (existing >= 0) {
            store[table][existing] = { ...store[table][existing], ...row }
          } else {
            const newRow = {
              id: `row-${store[table].length}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...row,
            }
            store[table].push(newRow)
            // Fire realtime callbacks for inserts
            for (const cb of realtimeCallbacks) {
              cb({ new: newRow })
            }
          }
        }
        return { data: rows, error: null }
      },
    }),
    channel: (_name: string) => ({
      on: (
        _event: string,
        _config: unknown,
        callback: (payload: { new: MockRow }) => void
      ) => {
        realtimeCallbacks.push(callback)
        return {
          subscribe: () => ({
            unsubscribe: vi.fn(),
          }),
        }
      },
    }),
    removeChannel: vi.fn(),
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { user: { id: 'usr_test', email: 'test@test.com' } },
        },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }

  return {
    client,
    store,
    /** Directly inject a row into the store (simulates server-side insert) */
    injectRow(table: string, row: MockRow) {
      store[table] = store[table] ?? []
      store[table].push(row)
    },
    /** Get all rows in a table */
    getRows(table: string): MockRow[] {
      return store[table] ?? []
    },
    /** Fire realtime callbacks manually */
    fireRealtime(row: MockRow) {
      for (const cb of realtimeCallbacks) {
        cb({ new: row })
      }
    },
  }
}
