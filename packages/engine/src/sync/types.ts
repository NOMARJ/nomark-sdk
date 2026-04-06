import { z } from 'zod'
import { SigPrefSchema, SigMapSchema, SigAsnSchema, SigMetaSchema } from '../schema.js'

// --- Syncable signal types (no rub — not syncable) ---

const SyncableLedgerEntry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('meta'), data: SigMetaSchema }),
  z.object({ type: z.literal('pref'), data: SigPrefSchema }),
  z.object({ type: z.literal('map'), data: SigMapSchema }),
  z.object({ type: z.literal('asn'), data: SigAsnSchema }),
])

// --- Sync entry: ledger entry + sync metadata ---

export const SyncEntrySchema = SyncableLedgerEntry.and(
  z.object({
    sync_version: z.number().int().min(0),
    user_id: z.string().min(1),
    updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
  })
)

export type SyncEntry = z.infer<typeof SyncEntrySchema>

// --- Sync status ---

export const SyncStatusSchema = z.object({
  connected: z.boolean(),
  last_push: z.string().nullable(),
  last_pull: z.string().nullable(),
  pending_ops: z.number().int().min(0),
  sync_version: z.number().int().min(0),
})

export type SyncStatus = z.infer<typeof SyncStatusSchema>

// --- Offline operation ---

export const OfflineOpSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['push', 'pull']),
  entries: z.array(SyncEntrySchema),
  created_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
})

export type OfflineOp = z.infer<typeof OfflineOpSchema>

// --- Sync config ---

export const SyncConfigSchema = z.object({
  supabaseUrl: z.string().min(1),
  supabaseKey: z.string().min(1),
  userId: z.string().min(1),
})

export type SyncConfig = z.infer<typeof SyncConfigSchema>

// --- Conflict strategy ---

export type ConflictStrategy = 'archive-wins' | 'local-wins'

// --- Supabase row types (mirror DB schema) ---

export type LedgerRow = {
  id: string
  user_id: string
  signal_type: 'meta' | 'pref' | 'map' | 'asn'
  dim_key: string
  scope: string
  data: Record<string, unknown>
  sync_version: number
  created_at: string
  updated_at: string
}

export type TeamPreferenceRow = {
  id: string
  team_id: string
  signal_type: 'pref' | 'map' | 'asn'
  dim_key: string
  scope: string
  data: Record<string, unknown>
  set_by: string
  sync_version: number
  created_at: string
  updated_at: string
}

export type TeamMemberRow = {
  id: string
  team_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
}
