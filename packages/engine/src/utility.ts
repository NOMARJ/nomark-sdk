import { type LedgerEntry, type SignalType } from './schema.js'
import { ENTRY_CAPS, TOTAL_CAP } from './ledger.js'

type UtilityInput = {
  last: string
  n?: number
  total?: number
  ctd?: number
  src?: Partial<Record<string, number>>
  _uses_30d?: number
  _impact?: number
}

/**
 * Compute utility score for a ledger entry (MEE Spec Section 7.3).
 *
 * U = (F × 0.25) + (I × 0.25) + (R × 0.20) + (P × 0.15) + (T × 0.15)
 *
 * F = Frequency: min(1.0, usage_count_last_30_days / 10)
 * I = Impact: correction cost (0.0-1.0), set at promotion
 * R = Recency: max(0.0, 1.0 - days_since_last / 180)
 * P = Portability: unique_context_sources / total_available_contexts
 * T = Stability: 1.0 - (contradiction_count / max(signal_count, 1))
 */
export function utilityScore(entry: UtilityInput, now: Date = new Date()): number {
  const last = new Date(entry.last)
  const daysSinceLast = Math.max(0, (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  const frequency = Math.min(1.0, (entry._uses_30d ?? 0) / 10)
  const impact = entry._impact ?? 0.5
  const recency = Math.max(0, 1.0 - daysSinceLast / 180)

  const n = entry.n ?? entry.total ?? 0
  const ctd = entry.ctd ?? 0

  let portability = 0
  if (entry.src) {
    portability = Object.values(entry.src).filter((v): v is number => (v ?? 0) > 0).length / 3
  }

  const stability = n > 0 ? 1.0 - (ctd / n) : 0.5

  return (frequency * 0.25) + (impact * 0.25) + (recency * 0.20) + (portability * 0.15) + (stability * 0.15)
}

/**
 * Check if an entry is protected from pruning.
 *
 * Protected entries:
 * - [sig:meta] — always protected
 * - [sig:rub] with stage proven or trusted
 * - [sig:pref] with n >= 15 and ctd === 0 (safety shield: +0.5 bonus)
 */
export function isProtected(entry: LedgerEntry): boolean {
  if (entry.type === 'meta') return true
  if (entry.type === 'rub' && (entry.data.stage === 'proven' || entry.data.stage === 'trusted')) return true
  if (entry.type === 'pref' && entry.data.n >= 15 && entry.data.ctd === 0) return true
  return false
}

/**
 * Prune entries to fit within capacity constraints.
 * Removes lowest-utility entries first, never removes protected entries.
 * Returns pruned list + evicted entries.
 */
export function pruneToCapacity(
  entries: LedgerEntry[],
  now: Date = new Date(),
): { kept: LedgerEntry[]; evicted: LedgerEntry[] } {
  const kept = [...entries]
  const evicted: LedgerEntry[] = []

  // First enforce per-type caps
  const byType = new Map<SignalType, { entry: LedgerEntry; index: number; utility: number }[]>()
  for (let i = 0; i < kept.length; i++) {
    const entry = kept[i]!
    const type = entry.type
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type)!.push({
      entry,
      index: i,
      utility: utilityScore(entry.data as UtilityInput, now),
    })
  }

  const toRemove = new Set<number>()
  for (const [type, items] of byType) {
    const cap = ENTRY_CAPS[type]
    if (items.length <= cap) continue

    // Sort by utility ascending, remove lowest first (skip protected)
    items.sort((a, b) => a.utility - b.utility)
    let removed = 0
    for (const item of items) {
      if (items.length - removed <= cap) break
      if (!isProtected(item.entry)) {
        toRemove.add(item.index)
        removed++
      }
    }
  }

  // Remove in reverse index order to maintain indices
  const sortedRemoval = [...toRemove].sort((a, b) => b - a)
  for (const idx of sortedRemoval) {
    evicted.push(kept.splice(idx, 1)[0]!)
  }

  // Then enforce total cap
  while (kept.length > TOTAL_CAP) {
    let lowestIdx = -1
    let lowestUtility = Infinity

    for (let i = 0; i < kept.length; i++) {
      if (isProtected(kept[i]!)) continue
      const u = utilityScore(kept[i]!.data as UtilityInput, now)
      if (u < lowestUtility) {
        lowestUtility = u
        lowestIdx = i
      }
    }

    if (lowestIdx === -1) break // all remaining are protected
    evicted.push(kept.splice(lowestIdx, 1)[0]!)
  }

  return { kept, evicted }
}
