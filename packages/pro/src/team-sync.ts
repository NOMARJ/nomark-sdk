import type { LedgerEntry } from '@nomark-ai/engine'

export type TeamSyncConfig = {
  teamId: string
  userId: string
  role: 'admin' | 'member'
  supabaseUrl: string
  supabaseKey: string
  db?: unknown
}

export type TeamSync = {
  pushTeamPreferences: (entries: LedgerEntry[]) => Promise<{ synced: number }>
  pullTeamPreferences: () => Promise<LedgerEntry[]>
  resolveHierarchy: (
    platformDefaults: LedgerEntry[],
    teamBaseline: LedgerEntry[],
    individual: LedgerEntry[]
  ) => LedgerEntry[]
}

function ledgerKey(entry: LedgerEntry): string {
  const data = entry.data as Record<string, unknown>
  const dim = (data.dim as string) ?? (data.field as string) ?? (data.trigger as string) ?? '_meta'
  const scope = (data.scope as string) ?? '*'
  return `${entry.type}:${dim}:${scope}`
}

export function createTeamSync(config: TeamSyncConfig): TeamSync {
  const db = config.db as TeamDb

  return {
    async pushTeamPreferences(entries: LedgerEntry[]): Promise<{ synced: number }> {
      if (config.role !== 'admin') {
        throw new Error('Only team admins can push team preferences')
      }

      const rows = entries.map(e => ({
        team_id: config.teamId,
        signal_type: e.type,
        dim_key: ledgerKey(e),
        scope: (e.data as Record<string, unknown>).scope ?? '*',
        data: e.data,
        set_by: config.userId,
        sync_version: 1,
      }))

      const result = db.from('team_preferences').upsert(rows)
      if (result.error) throw new Error(result.error.message)
      return { synced: entries.length }
    },

    async pullTeamPreferences(): Promise<LedgerEntry[]> {
      const result = db.from('team_preferences').select().eq('team_id', config.teamId)
      if (result.error) throw new Error(result.error.message)

      return (result.data ?? []).map((row: { signal_type: string; data: unknown }) => ({
        type: row.signal_type,
        data: row.data,
      })) as LedgerEntry[]
    },

    resolveHierarchy(
      platformDefaults: LedgerEntry[],
      teamBaseline: LedgerEntry[],
      individual: LedgerEntry[]
    ): LedgerEntry[] {
      // Three-level hierarchy: individual > team > platform
      // Most specific wins (same key resolution)
      const merged = new Map<string, LedgerEntry>()

      // Layer 1: platform defaults (lowest priority)
      for (const e of platformDefaults) {
        merged.set(ledgerKey(e), e)
      }

      // Layer 2: team baseline (overrides platform)
      for (const e of teamBaseline) {
        merged.set(ledgerKey(e), e)
      }

      // Layer 3: individual (overrides team)
      for (const e of individual) {
        merged.set(ledgerKey(e), e)
      }

      return Array.from(merged.values())
    },
  }
}

type TeamDb = {
  from: (table: string) => {
    select: () => { eq: (col: string, val: string) => { data: unknown[]; error: { message: string } | null } }
    upsert: (rows: unknown[]) => { data: unknown[]; error: { message: string } | null }
    insert: (rows: unknown[]) => { data: unknown[]; error: { message: string } | null }
    delete: () => { eq: (col: string, val: string) => { data: unknown; error: { message: string } | null } }
  }
}
