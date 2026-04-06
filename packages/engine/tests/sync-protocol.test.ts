import { describe, it, expect } from 'vitest'
import { stageForSync, unstage, resolveConflict, isStaged } from '../src/sync/protocol.js'
import type { LedgerEntry } from '../src/schema.js'

const basePref: LedgerEntry = {
  type: 'pref',
  data: { dim: 'tone', target: 'direct', w: 0.9, n: 20, src: { code: 12 }, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' },
}

const baseMap: LedgerEntry = {
  type: 'map',
  data: { trigger: 'make it shorter', pattern_type: 'rewrite_request', intent: ['reduce_length_40pct'], n: 8, scope: '*', last: '2026-04-06', conf: 0.85 },
}

describe('stageForSync', () => {
  it('applies 0.8x weight to pref entries', () => {
    const staged = stageForSync(basePref)
    expect(staged.type).toBe('pref')
    const data = staged.data as { w: number; staged: boolean }
    expect(data.w).toBeCloseTo(0.72) // 0.9 * 0.8
    expect(data.staged).toBe(true)
  })

  it('marks map entries as staged without modifying weight', () => {
    const staged = stageForSync(baseMap)
    const data = staged.data as { staged: boolean; conf: number }
    expect(data.staged).toBe(true)
    expect(data.conf).toBe(0.85) // maps don't have w, conf stays
  })

  it('marks meta entries as staged', () => {
    const meta: LedgerEntry = {
      type: 'meta',
      data: { profile: { tone: 'direct' }, signals: 47, by_ctx: {}, by_out: {}, avg_conf: 0.82, avg_q: 3.2, updated: '2026-04-06' },
    }
    const staged = stageForSync(meta)
    expect((staged.data as { staged: boolean }).staged).toBe(true)
  })
})

describe('unstage', () => {
  it('restores original weight on pref entries', () => {
    const staged = stageForSync(basePref)
    const unstaged = unstage(staged, 0.9)
    const data = unstaged.data as { w: number; staged?: boolean }
    expect(data.w).toBe(0.9)
    expect(data.staged).toBeUndefined()
  })

  it('removes staged flag from map entries', () => {
    const staged = stageForSync(baseMap)
    const unstaged = unstage(staged)
    expect((unstaged.data as { staged?: boolean }).staged).toBeUndefined()
  })
})

describe('isStaged', () => {
  it('returns true for staged entries', () => {
    const staged = stageForSync(basePref)
    expect(isStaged(staged)).toBe(true)
  })

  it('returns false for non-staged entries', () => {
    expect(isStaged(basePref)).toBe(false)
  })
})

describe('resolveConflict', () => {
  it('returns remote entry with archive-wins strategy', () => {
    const local = { ...basePref, data: { ...basePref.data, w: 0.7 } } as LedgerEntry
    const remote = { ...basePref, data: { ...basePref.data, w: 0.95 } } as LedgerEntry
    const result = resolveConflict(local, remote, 'archive-wins')
    expect((result.data as { w: number }).w).toBe(0.95)
  })

  it('returns local entry with local-wins strategy', () => {
    const local = { ...basePref, data: { ...basePref.data, w: 0.7 } } as LedgerEntry
    const remote = { ...basePref, data: { ...basePref.data, w: 0.95 } } as LedgerEntry
    const result = resolveConflict(local, remote, 'local-wins')
    expect((result.data as { w: number }).w).toBe(0.7)
  })

  it('defaults to archive-wins', () => {
    const local = { ...basePref, data: { ...basePref.data, w: 0.7 } } as LedgerEntry
    const remote = { ...basePref, data: { ...basePref.data, w: 0.95 } } as LedgerEntry
    const result = resolveConflict(local, remote)
    expect((result.data as { w: number }).w).toBe(0.95)
  })
})
