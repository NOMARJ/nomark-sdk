import { describe, it, expect } from 'vitest'
import { diffLedger, mergeLedger, entryKey } from '../src/sync/merge.js'
import type { LedgerEntry } from '../src/schema.js'

const mkPref = (dim: string, w: number, scope = '*'): LedgerEntry => ({
  type: 'pref',
  data: { dim, target: 'direct', w, n: 10, src: { code: 5 }, ctd: 0, scope, decay: 0.97, last: '2026-04-06' },
})

const mkMap = (trigger: string): LedgerEntry => ({
  type: 'map',
  data: { trigger, pattern_type: 'rewrite_request' as const, intent: ['reduce'], n: 5, scope: '*', last: '2026-04-06', conf: 0.8 },
})

describe('entryKey', () => {
  it('uses type:dim:scope for pref entries', () => {
    expect(entryKey(mkPref('tone', 0.9))).toBe('pref:tone:*')
  })

  it('uses type:trigger:scope for map entries', () => {
    expect(entryKey(mkMap('make it shorter'))).toBe('map:make it shorter:*')
  })

  it('uses type:field:scope for asn entries', () => {
    const asn: LedgerEntry = {
      type: 'asn',
      data: { field: 'audience', default: 'devs', accuracy: 0.9, total: 10, correct: 9, last: '2026-04-06' },
    }
    expect(entryKey(asn)).toBe('asn:audience:*')
  })

  it('uses type:_meta:* for meta entries', () => {
    const meta: LedgerEntry = {
      type: 'meta',
      data: { profile: {}, signals: 0, by_ctx: {}, by_out: {}, avg_conf: 0, avg_q: 0, updated: '2026-04-06' },
    }
    expect(entryKey(meta)).toBe('meta:_meta:*')
  })
})

describe('diffLedger', () => {
  it('detects added entries', () => {
    const local: LedgerEntry[] = []
    const remote = [mkPref('tone', 0.9)]
    const diff = diffLedger(local, remote)
    expect(diff.added).toHaveLength(1)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
  })

  it('detects removed entries', () => {
    const local = [mkPref('tone', 0.9)]
    const remote: LedgerEntry[] = []
    const diff = diffLedger(local, remote)
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(1)
  })

  it('detects modified entries (same key, different data)', () => {
    const local = [mkPref('tone', 0.7)]
    const remote = [mkPref('tone', 0.95)]
    const diff = diffLedger(local, remote)
    expect(diff.modified).toHaveLength(1)
    expect(diff.modified[0].local).toBeDefined()
    expect(diff.modified[0].remote).toBeDefined()
  })

  it('reports unchanged entries', () => {
    const entries = [mkPref('tone', 0.9)]
    const diff = diffLedger(entries, entries)
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
    expect(diff.unchanged).toHaveLength(1)
  })
})

describe('mergeLedger', () => {
  it('archive-wins keeps remote version on conflict', () => {
    const local = [mkPref('tone', 0.7)]
    const remote = [mkPref('tone', 0.95)]
    const merged = mergeLedger(local, remote, 'archive-wins')
    expect(merged).toHaveLength(1)
    expect((merged[0].data as { w: number }).w).toBe(0.95)
  })

  it('local-wins keeps local version on conflict', () => {
    const local = [mkPref('tone', 0.7)]
    const remote = [mkPref('tone', 0.95)]
    const merged = mergeLedger(local, remote, 'local-wins')
    expect(merged).toHaveLength(1)
    expect((merged[0].data as { w: number }).w).toBe(0.7)
  })

  it('includes entries only in remote (additions)', () => {
    const local = [mkPref('tone', 0.9)]
    const remote = [mkPref('tone', 0.9), mkPref('length', 0.8)]
    const merged = mergeLedger(local, remote, 'archive-wins')
    expect(merged).toHaveLength(2)
  })

  it('includes entries only in local (not removed by remote)', () => {
    const local = [mkPref('tone', 0.9), mkPref('length', 0.8)]
    const remote = [mkPref('tone', 0.9)]
    const merged = mergeLedger(local, remote, 'archive-wins')
    expect(merged).toHaveLength(2)
  })

  it('handles empty local', () => {
    const remote = [mkPref('tone', 0.9)]
    expect(mergeLedger([], remote, 'archive-wins')).toHaveLength(1)
  })

  it('handles empty remote', () => {
    const local = [mkPref('tone', 0.9)]
    expect(mergeLedger(local, [], 'archive-wins')).toHaveLength(1)
  })
})
