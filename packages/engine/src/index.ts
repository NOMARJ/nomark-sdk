export { type SignalType, type LedgerEntry, type SigPref, type SigCog, type CogEvidence, type SigMap, type SigAsn, type SigMeta, type SigRub } from './schema.js'
export { type Context, type Outcome, type RequestType, type Scope, type PatternType, type RubricStage } from './schema.js'
export { SigPrefSchema, SigCogSchema, CogEvidenceSchema, SigMapSchema, SigAsnSchema, SigMetaSchema, LedgerEntrySchema, isStylisticPref } from './schema.js'
export { parseLedger, writeLedger, parseLedgerLine, formatLedgerLine, ENTRY_CAPS, TOTAL_CAP } from './ledger.js'
export { computeDecay, effectiveWeight } from './decay.js'
export { utilityScore, pruneToCapacity } from './utility.js'
export { classify, type ClassificationResult } from './classifier.js'
export { createResolver, type ResolverConfig, type ResolverResult } from './resolver.js'
export {
  detectContradictions,
  type Contradiction,
  type ContradictionResolution,
  type DetectContradictionsOptions,
} from './detectContradictions.js'

// --- Sync ---
export {
  createSyncClient, type SyncClient, type PushResult,
  filterSyncable,
  stageForSync, unstage, isStaged, resolveConflict,
  diffLedger, mergeLedger, entryKey, type LedgerDiff,
  OfflineQueue,
  type SyncEntry, type SyncStatus, type SyncConfig, type OfflineOp, type ConflictStrategy,
  type LedgerRow, type TeamPreferenceRow, type TeamMemberRow,
  SyncEntrySchema, SyncStatusSchema, OfflineOpSchema, SyncConfigSchema,
} from './sync/index.js'

// --- Importers ---
export {
  type Conversation, type Message, type Platform, type MigrationReport,
  type ExtractedSignal, type MigrationOptions, type PlatformParser,
  parseChatGPTExport, chatgptParser,
  parseClaudeExport, claudeParser,
  extractSignals, runMigration,
  getConfidenceBand, getConfidenceWeight,
} from './importers/index.js'
