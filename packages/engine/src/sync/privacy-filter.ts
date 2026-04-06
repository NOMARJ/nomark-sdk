import type { LedgerEntry } from '../schema.js'

const SYNCABLE_TYPES = new Set(['pref', 'map', 'asn', 'meta'])
const STRIP_FIELDS = new Set(['note'])

export function filterSyncable(entries: LedgerEntry[]): LedgerEntry[] {
  return entries
    .filter(e => SYNCABLE_TYPES.has(e.type))
    .map(e => {
      const cleaned = { ...e.data }
      for (const field of STRIP_FIELDS) {
        delete (cleaned as Record<string, unknown>)[field]
      }
      return { ...e, data: cleaned } as LedgerEntry
    })
}
