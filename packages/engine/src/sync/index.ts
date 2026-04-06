export { createSyncClient, type SyncClient, type PushResult } from './client.js'
export { filterSyncable } from './privacy-filter.js'
export { stageForSync, unstage, isStaged, resolveConflict } from './protocol.js'
export { diffLedger, mergeLedger, entryKey, type LedgerDiff } from './merge.js'
export { OfflineQueue } from './offline-queue.js'
export {
  type SyncEntry,
  type SyncStatus,
  type SyncConfig,
  type OfflineOp,
  type ConflictStrategy,
  type LedgerRow,
  type TeamPreferenceRow,
  type TeamMemberRow,
  SyncEntrySchema,
  SyncStatusSchema,
  OfflineOpSchema,
  SyncConfigSchema,
} from './types.js'
