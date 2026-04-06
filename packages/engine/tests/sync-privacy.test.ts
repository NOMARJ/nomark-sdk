import { describe, it, expect } from 'vitest'
import { filterSyncable } from '../src/sync/privacy-filter.js'
import type { LedgerEntry } from '../src/schema.js'

const prefEntry: LedgerEntry = {
  type: 'pref',
  data: { dim: 'tone', target: 'direct', w: 0.9, n: 20, src: { code: 12 }, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' },
}

const mapEntry: LedgerEntry = {
  type: 'map',
  data: { trigger: 'make it shorter', pattern_type: 'rewrite_request', intent: ['reduce_length_40pct'], n: 8, scope: '*', last: '2026-04-06', conf: 0.85 },
}

const asnEntry: LedgerEntry = {
  type: 'asn',
  data: { field: 'audience', default: 'developers', accuracy: 0.92, total: 25, correct: 23, last: '2026-04-05' },
}

const metaEntry: LedgerEntry = {
  type: 'meta',
  data: { profile: { tone: 'direct' }, signals: 47, by_ctx: { code: 30 }, by_out: { accepted: 40 }, avg_conf: 0.82, avg_q: 3.2, updated: '2026-04-06' },
}

const rubEntry: LedgerEntry = {
  type: 'rub',
  data: { id: 'rub-1', fmt: 'email', stage: 'pending', uses: 5, accepts: 3, avg_ed: 0.2, dims: { tone: 0.8 }, min: 0.5, last: '2026-04-06' },
}

describe('filterSyncable', () => {
  it('passes pref, map, asn, meta entries through', () => {
    const result = filterSyncable([prefEntry, mapEntry, asnEntry, metaEntry])
    expect(result).toHaveLength(4)
  })

  it('excludes rub entries', () => {
    const result = filterSyncable([prefEntry, rubEntry, mapEntry])
    expect(result).toHaveLength(2)
    expect(result.every(e => e.type !== 'rub')).toBe(true)
  })

  it('strips note field from pref entries', () => {
    const withNote: LedgerEntry = {
      type: 'pref',
      data: { ...prefEntry.data, note: 'some raw user text here' } as LedgerEntry['data'],
    }
    const result = filterSyncable([withNote])
    expect(result).toHaveLength(1)
    expect((result[0].data as Record<string, unknown>).note).toBeUndefined()
  })

  it('returns empty array for empty input', () => {
    expect(filterSyncable([])).toEqual([])
  })

  it('returns empty array when all entries are rub', () => {
    expect(filterSyncable([rubEntry, rubEntry])).toEqual([])
  })
})
