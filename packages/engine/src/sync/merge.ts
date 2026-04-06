import type { LedgerEntry } from '../schema.js'
import type { ConflictStrategy } from './types.js'
import { resolveConflict } from './protocol.js'

export function entryKey(entry: LedgerEntry): string {
  const data = entry.data as Record<string, unknown>
  const dim = (data.dim as string) ?? (data.field as string) ?? (data.trigger as string) ?? '_meta'
  const scope = (data.scope as string) ?? '*'
  return `${entry.type}:${dim}:${scope}`
}

export type LedgerDiff = {
  added: LedgerEntry[]
  removed: LedgerEntry[]
  modified: Array<{ key: string; local: LedgerEntry; remote: LedgerEntry }>
  unchanged: LedgerEntry[]
}

export function diffLedger(local: LedgerEntry[], remote: LedgerEntry[]): LedgerDiff {
  const localMap = new Map(local.map(e => [entryKey(e), e]))
  const remoteMap = new Map(remote.map(e => [entryKey(e), e]))

  const added: LedgerEntry[] = []
  const removed: LedgerEntry[] = []
  const modified: LedgerDiff['modified'] = []
  const unchanged: LedgerEntry[] = []

  for (const [key, re] of remoteMap) {
    const le = localMap.get(key)
    if (!le) {
      added.push(re)
    } else if (JSON.stringify(le.data) !== JSON.stringify(re.data)) {
      modified.push({ key, local: le, remote: re })
    } else {
      unchanged.push(le)
    }
  }

  for (const [key, le] of localMap) {
    if (!remoteMap.has(key)) {
      removed.push(le)
    }
  }

  return { added, removed, modified, unchanged }
}

export function mergeLedger(
  local: LedgerEntry[],
  remote: LedgerEntry[],
  strategy: ConflictStrategy
): LedgerEntry[] {
  const diff = diffLedger(local, remote)
  const result: LedgerEntry[] = []

  // Keep unchanged
  result.push(...diff.unchanged)

  // Resolve conflicts
  for (const { local: le, remote: re } of diff.modified) {
    result.push(resolveConflict(le, re, strategy))
  }

  // Include additions from remote
  result.push(...diff.added)

  // Keep local-only entries (not removed by merge — sync is additive)
  result.push(...diff.removed)

  return result
}
