import { type LedgerEntry, type SignalType, LedgerEntrySchema } from './schema.js'

export const ENTRY_CAPS: Record<SignalType, number> = {
  meta: 1,
  pref: 20,
  map: 10,
  asn: 5,
  rub: 4,
}

export const TOTAL_CAP = 40

const SIGNAL_PREFIX_RE = /^\[sig:(\w+)\]\s+(.+)$/

/**
 * Parse a single ledger line: `[sig:type] {json}`
 * Returns null for empty or unparseable lines.
 */
export function parseLedgerLine(line: string): LedgerEntry | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const match = trimmed.match(SIGNAL_PREFIX_RE)
  if (!match) return null

  const type = match[1] as SignalType
  let data: unknown
  try {
    data = JSON.parse(match[2]!)
  } catch {
    return null
  }

  const result = LedgerEntrySchema.safeParse({ type, data })
  if (!result.success) return null

  return result.data
}

/**
 * Format a ledger entry back to `[sig:type] {json}` string.
 */
export function formatLedgerLine(entry: LedgerEntry): string {
  return `[sig:${entry.type}] ${JSON.stringify(entry.data)}`
}

/**
 * Parse a full ledger JSONL string into typed entries.
 */
export function parseLedger(content: string): LedgerEntry[] {
  return content
    .split('\n')
    .map(parseLedgerLine)
    .filter((e): e is LedgerEntry => e !== null)
}

/**
 * Serialize ledger entries to JSONL string with typed prefixes.
 */
export function writeLedger(entries: LedgerEntry[]): string {
  return entries.map(formatLedgerLine).join('\n') + '\n'
}

/**
 * Count entries by type.
 */
export function countByType(entries: LedgerEntry[]): Record<SignalType, number> {
  const counts: Record<SignalType, number> = { meta: 0, pref: 0, map: 0, asn: 0, rub: 0 }
  for (const entry of entries) {
    counts[entry.type]++
  }
  return counts
}

/**
 * Check if ledger exceeds capacity constraints.
 * Returns violations or empty array if within limits.
 */
export function checkCapacity(entries: LedgerEntry[]): string[] {
  const violations: string[] = []
  const counts = countByType(entries)

  if (entries.length > TOTAL_CAP) {
    violations.push(`total ${entries.length} exceeds cap ${TOTAL_CAP}`)
  }

  for (const [type, cap] of Object.entries(ENTRY_CAPS)) {
    const count = counts[type as SignalType] ?? 0
    if (count > cap) {
      violations.push(`${type} count ${count} exceeds cap ${cap}`)
    }
  }

  return violations
}

/**
 * Estimate token count for ledger entries (~75 tokens per entry).
 */
export function estimateTokens(entries: LedgerEntry[]): number {
  return entries.length * 75
}
