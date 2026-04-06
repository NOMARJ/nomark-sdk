import { describe, it, expect } from 'vitest'
import { utilityScore, isProtected, pruneToCapacity } from '../src/utility.js'
import type { LedgerEntry } from '../src/schema.js'

const NOW = new Date('2026-04-06')

describe('utilityScore', () => {
  it('scores recent high-frequency entries high', () => {
    const score = utilityScore({
      last: '2026-04-05', n: 20, ctd: 0,
      src: { chat: 10, code: 10 },
      _uses_30d: 10, _impact: 0.8,
    }, NOW)
    expect(score).toBeGreaterThan(0.7)
  })

  it('scores old unused entries low', () => {
    const score = utilityScore({
      last: '2025-10-01', n: 2, ctd: 1,
      src: { chat: 2 },
      _uses_30d: 0, _impact: 0.3,
    }, NOW)
    expect(score).toBeLessThan(0.3)
  })

  it('defaults impact to 0.5 when not provided', () => {
    const score = utilityScore({ last: '2026-04-06', n: 5, ctd: 0 }, NOW)
    expect(score).toBeGreaterThan(0)
  })

  it('portability increases with more context sources', () => {
    const oneCtx = utilityScore({ last: '2026-04-06', n: 5, ctd: 0, src: { code: 5 } }, NOW)
    const twoCtx = utilityScore({ last: '2026-04-06', n: 5, ctd: 0, src: { code: 3, chat: 2 } }, NOW)
    const threeCtx = utilityScore({ last: '2026-04-06', n: 5, ctd: 0, src: { code: 2, chat: 2, cowork: 1 } }, NOW)
    expect(twoCtx).toBeGreaterThan(oneCtx)
    expect(threeCtx).toBeGreaterThan(twoCtx)
  })

  it('stability decreases with contradictions', () => {
    const stable = utilityScore({ last: '2026-04-06', n: 10, ctd: 0 }, NOW)
    const unstable = utilityScore({ last: '2026-04-06', n: 10, ctd: 5 }, NOW)
    expect(stable).toBeGreaterThan(unstable)
  })
})

describe('isProtected', () => {
  it('protects meta entries', () => {
    const meta: LedgerEntry = {
      type: 'meta',
      data: {
        profile: {}, signals: 0,
        by_ctx: { chat: 0, code: 0, cowork: 0 },
        by_out: { accepted: 0 },
        avg_conf: 0.5, avg_q: 1.5, updated: '2026-04-06',
      },
    }
    expect(isProtected(meta)).toBe(true)
  })

  it('protects proven rubrics', () => {
    const rub: LedgerEntry = {
      type: 'rub',
      data: {
        id: 'rub-001', fmt: 'report', stage: 'proven',
        uses: 10, accepts: 8, avg_ed: 0.12,
        dims: { clarity: 0.5, accuracy: 0.5 },
        min: 0.7, last: '2026-04-01',
      },
    }
    expect(isProtected(rub)).toBe(true)
  })

  it('protects high-evidence prefs with zero contradictions', () => {
    const pref: LedgerEntry = {
      type: 'pref',
      data: {
        dim: 'tone', target: 'direct', w: 0.95, n: 20,
        src: { code: 20 }, ctd: 0, scope: '*',
        decay: 0.99, last: '2026-04-05',
      },
    }
    expect(isProtected(pref)).toBe(true)
  })

  it('does not protect low-evidence prefs', () => {
    const pref: LedgerEntry = {
      type: 'pref',
      data: {
        dim: 'tone', target: 'direct', w: 0.5, n: 5,
        src: { code: 5 }, ctd: 0, scope: '*',
        decay: 0.9, last: '2026-04-05',
      },
    }
    expect(isProtected(pref)).toBe(false)
  })

  it('does not protect prefs with contradictions even if high-evidence', () => {
    const pref: LedgerEntry = {
      type: 'pref',
      data: {
        dim: 'tone', target: 'direct', w: 0.95, n: 20,
        src: { code: 20 }, ctd: 1, scope: '*',
        decay: 0.99, last: '2026-04-05',
      },
    }
    expect(isProtected(pref)).toBe(false)
  })
})

describe('pruneToCapacity', () => {
  function makePref(dim: string, n: number, last: string): LedgerEntry {
    return {
      type: 'pref',
      data: {
        dim, target: dim, w: 0.5, n,
        src: { code: n }, ctd: 0, scope: '*',
        decay: 0.9, last,
      },
    }
  }

  const meta: LedgerEntry = {
    type: 'meta',
    data: {
      profile: {}, signals: 0,
      by_ctx: { chat: 0, code: 0, cowork: 0 },
      by_out: {},
      avg_conf: 0.5, avg_q: 1.5, updated: '2026-04-06',
    },
  }

  it('does nothing when within capacity', () => {
    const entries = [meta, makePref('tone', 5, '2026-04-05')]
    const { kept, evicted } = pruneToCapacity(entries, NOW)
    expect(kept).toHaveLength(2)
    expect(evicted).toHaveLength(0)
  })

  it('evicts lowest utility entries when over total cap', () => {
    const entries: LedgerEntry[] = [meta]
    for (let i = 0; i < 45; i++) {
      entries.push(makePref(`dim-${i}`, i + 1, '2026-04-05'))
    }
    const { kept, evicted } = pruneToCapacity(entries, NOW)
    expect(kept.length).toBeLessThanOrEqual(40)
    expect(evicted.length).toBeGreaterThan(0)
  })

  it('never evicts meta', () => {
    const entries: LedgerEntry[] = [meta]
    for (let i = 0; i < 45; i++) {
      entries.push(makePref(`dim-${i}`, 1, '2025-01-01'))
    }
    const { kept } = pruneToCapacity(entries, NOW)
    expect(kept.some(e => e.type === 'meta')).toBe(true)
  })

  it('never evicts protected prefs (safety shield)', () => {
    const protectedPref: LedgerEntry = {
      type: 'pref',
      data: {
        dim: 'protected', target: 'direct', w: 0.95, n: 20,
        src: { code: 20 }, ctd: 0, scope: '*',
        decay: 0.99, last: '2026-04-05',
      },
    }

    const entries: LedgerEntry[] = [meta, protectedPref]
    for (let i = 0; i < 45; i++) {
      entries.push(makePref(`dim-${i}`, 1, '2025-01-01'))
    }
    const { kept } = pruneToCapacity(entries, NOW)
    expect(kept.some(e => e.type === 'pref' && e.data.dim === 'protected')).toBe(true)
  })
})
