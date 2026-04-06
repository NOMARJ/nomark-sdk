import type { LedgerEntry } from '../schema.js'
import type { ConflictStrategy } from './types.js'

const STAGING_WEIGHT_FACTOR = 0.8

export function stageForSync(entry: LedgerEntry): LedgerEntry {
  const data = { ...entry.data, staged: true } as Record<string, unknown>

  if (entry.type === 'pref' && typeof data.w === 'number') {
    data.w = data.w * STAGING_WEIGHT_FACTOR
  }

  return { type: entry.type, data } as LedgerEntry
}

export function unstage(entry: LedgerEntry, originalWeight?: number): LedgerEntry {
  const data = { ...entry.data } as Record<string, unknown>
  delete data.staged

  if (entry.type === 'pref' && originalWeight !== undefined) {
    data.w = originalWeight
  }

  return { type: entry.type, data } as LedgerEntry
}

export function isStaged(entry: LedgerEntry): boolean {
  return (entry.data as Record<string, unknown>).staged === true
}

export function resolveConflict(
  local: LedgerEntry,
  remote: LedgerEntry,
  strategy: ConflictStrategy = 'archive-wins'
): LedgerEntry {
  return strategy === 'archive-wins' ? remote : local
}
