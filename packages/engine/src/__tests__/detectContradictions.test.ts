import { describe, it, expect } from 'vitest'
import { detectContradictions } from '../detectContradictions.js'
import type { LedgerEntry, SigPref } from '../schema.js'

const NOW = new Date('2026-04-11')

function makePref(overrides: Partial<SigPref> = {}): SigPref {
  return {
    dim: 'tone',
    target: 'direct',
    w: 0.9,
    n: 20,
    src: { chat: 8, code: 12 },
    ctd: 0,
    scope: '*',
    decay: 0.95,
    last: '2026-04-10',
    ...overrides,
  }
}

function entry(pref: SigPref): LedgerEntry {
  return { type: 'pref', data: pref }
}

describe('detectContradictions', () => {
  it('returns no conflicts when entries agree or cover different dimensions', () => {
    const entries: LedgerEntry[] = [
      entry(makePref({ dim: 'tone', target: 'direct' })),
      entry(makePref({ dim: 'format', target: 'bullets' })),
      entry(makePref({ dim: 'tone', target: 'direct', last: '2026-04-01' })),
    ]

    const result = detectContradictions(entries, { now: NOW })
    expect(result).toEqual([])
  })

  it('does not flag scoped overrides — different scopes cleanly override', () => {
    const entries: LedgerEntry[] = [
      entry(makePref({ dim: 'tone', target: 'direct', scope: '*' })),
      entry(makePref({ dim: 'tone', target: 'playful', scope: 'context:chat' })),
      entry(makePref({ dim: 'tone', target: 'terse', scope: 'context:code' })),
    ]

    const result = detectContradictions(entries, { now: NOW })
    expect(result).toEqual([])
  })

  it('flags a global+scoped contradiction when two entries share the same scope', () => {
    const entries: LedgerEntry[] = [
      entry(makePref({ dim: 'tone', target: 'direct', scope: '*', n: 20, w: 0.9, last: '2026-04-10' })),
      entry(makePref({ dim: 'tone', target: 'friendly', scope: '*', n: 3, w: 0.5, last: '2026-03-01' })),
    ]

    const result = detectContradictions(entries, { now: NOW })
    expect(result).toHaveLength(1)
    const [conflict] = result
    expect(conflict!.dimension).toBe('tone')
    expect(conflict!.scope).toBe('*')
    expect(conflict!.entries).toHaveLength(2)
    expect(conflict!.resolution.recommended.target).toBe('direct')
    expect(conflict!.resolution.margin).toBeGreaterThan(0)
  })

  it('flags a multi-way contradiction when 3+ entries disagree in the same scope', () => {
    const entries: LedgerEntry[] = [
      entry(makePref({ dim: 'format', target: 'bullets', scope: 'context:code', n: 15, last: '2026-04-10' })),
      entry(makePref({ dim: 'format', target: 'prose',   scope: 'context:code', n: 8,  last: '2026-04-05' })),
      entry(makePref({ dim: 'format', target: 'table',   scope: 'context:code', n: 4,  last: '2026-03-20' })),
    ]

    const result = detectContradictions(entries, { now: NOW })
    expect(result).toHaveLength(1)
    const [conflict] = result
    expect(conflict!.entries).toHaveLength(3)
    expect(conflict!.resolution.recommended.target).toBe('bullets')
    expect(new Set(conflict!.entries.map(e => e.target))).toEqual(new Set(['bullets', 'prose', 'table']))
  })

  it('filters out stale entries below the effective-weight threshold', () => {
    const entries: LedgerEntry[] = [
      entry(makePref({ dim: 'tone', target: 'direct', scope: '*', w: 0.9, decay: 0.95 })),
      entry(makePref({ dim: 'tone', target: 'stale-ghost', scope: '*', w: 0.2, decay: 0.1 })),
    ]

    const result = detectContradictions(entries, { now: NOW })
    expect(result).toEqual([])
  })

  it('uses confidence-based tiebreak in the resolution reason', () => {
    const entries: LedgerEntry[] = [
      entry(makePref({ dim: 'verbosity', target: 'short', scope: '*', n: 10, w: 0.8, last: '2026-04-10', src: { chat: 5, code: 5 } })),
      entry(makePref({ dim: 'verbosity', target: 'long',  scope: '*', n: 10, w: 0.8, last: '2026-04-10', src: { chat: 5, code: 5 } })),
    ]

    const result = detectContradictions(entries, { now: NOW })
    expect(result).toHaveLength(1)
    const [conflict] = result
    expect(conflict!.entries).toHaveLength(2)
    expect(conflict!.resolution.margin).toBeLessThanOrEqual(0.05)
    expect(conflict!.resolution.reason).toMatch(/tiebreak/i)
  })

  it('ignores non-pref entries (map / asn / meta / rub)', () => {
    const entries: LedgerEntry[] = [
      { type: 'map', data: { trigger: 'shorter', pattern_type: 'rewrite_request', intent: ['reduce'], conf: 0.9, n: 4, last: '2026-04-01' } },
      { type: 'asn', data: { field: 'language', default: 'typescript', accuracy: 0.9, total: 10, correct: 9, last: '2026-04-01' } },
    ]

    const result = detectContradictions(entries, { now: NOW })
    expect(result).toEqual([])
  })
})
