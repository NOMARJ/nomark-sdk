import { describe, it, expect } from 'vitest'
import {
  scopeSpecificity, scopeMatches, resolverScore, resolveDimension,
  matchMeaningMaps, findDefaults, createResolver,
} from '../src/resolver.js'
import type { LedgerEntry, SigPref } from '../src/schema.js'

const NOW = new Date('2026-04-06')

function makePref(overrides: Partial<SigPref> = {}): SigPref {
  return {
    dim: 'tone', target: 'direct', w: 0.87, n: 20,
    src: { chat: 8, code: 12 }, ctd: 1, scope: '*',
    decay: 0.97, last: '2026-04-05',
    ...overrides,
  }
}

describe('scopeSpecificity', () => {
  it('returns 0.3 for global', () => expect(scopeSpecificity('*')).toBe(0.3))
  it('returns 0.7 for single scope', () => expect(scopeSpecificity('context:code')).toBe(0.7))
  it('returns 1.0 for compound scope', () => expect(scopeSpecificity('context:chat+topic:investor')).toBe(1.0))
})

describe('scopeMatches', () => {
  it('global matches everything', () => {
    expect(scopeMatches('*', 'code', 'auth')).toBe(true)
    expect(scopeMatches('*')).toBe(true)
  })

  it('context scope matches correct context', () => {
    expect(scopeMatches('context:code', 'code')).toBe(true)
    expect(scopeMatches('context:code', 'chat')).toBe(false)
  })

  it('compound scope matches both parts', () => {
    expect(scopeMatches('context:chat+topic:investor', 'chat', 'investor')).toBe(true)
    expect(scopeMatches('context:chat+topic:investor', 'code', 'investor')).toBe(false)
  })

  it('matches when no filter provided', () => {
    expect(scopeMatches('context:code')).toBe(true) // no context filter = don't exclude
  })
})

describe('resolverScore', () => {
  it('scores higher for more specific scopes', () => {
    const global = resolverScore(makePref({ scope: '*' }), NOW)
    const single = resolverScore(makePref({ scope: 'context:code' }), NOW)
    const compound = resolverScore(makePref({ scope: 'context:code+topic:auth' }), NOW)
    expect(single._score).toBeGreaterThan(global._score)
    expect(compound._score).toBeGreaterThan(single._score)
  })

  it('scores higher with more evidence', () => {
    const low = resolverScore(makePref({ n: 2 }), NOW)
    const high = resolverScore(makePref({ n: 20 }), NOW)
    expect(high._score).toBeGreaterThan(low._score)
  })

  it('scores higher for recent entries', () => {
    const recent = resolverScore(makePref({ last: '2026-04-05' }), NOW)
    const old = resolverScore(makePref({ last: '2025-10-01' }), NOW)
    expect(recent._score).toBeGreaterThan(old._score)
  })

  it('penalizes contradictions', () => {
    const stable = resolverScore(makePref({ ctd: 0 }), NOW)
    const contradicted = resolverScore(makePref({ ctd: 5 }), NOW)
    expect(contradicted._score).toBeLessThan(stable._score)
  })

  it('scores higher with more context sources (portability)', () => {
    const oneCtx = resolverScore(makePref({ src: { code: 20 } }), NOW)
    const twoCtx = resolverScore(makePref({ src: { code: 10, chat: 10 } }), NOW)
    expect(twoCtx._score).toBeGreaterThan(oneCtx._score)
  })

  it('includes factor breakdown', () => {
    const scored = resolverScore(makePref(), NOW)
    expect(scored._factors).toHaveProperty('specificity')
    expect(scored._factors).toHaveProperty('evidence')
    expect(scored._factors).toHaveProperty('recency')
    expect(scored._factors).toHaveProperty('stability')
    expect(scored._factors).toHaveProperty('portability')
    expect(scored._factors).toHaveProperty('contradiction_penalty')
  })

  it('computes effective weight', () => {
    const scored = resolverScore(makePref({ w: 0.9, decay: 0.95 }), NOW)
    expect(scored._effective_w).toBeCloseTo(0.855, 2)
  })
})

describe('resolveDimension', () => {
  const entries: LedgerEntry[] = [
    { type: 'pref', data: makePref({ dim: 'tone', target: 'direct', scope: '*', n: 20 }) },
    { type: 'pref', data: makePref({ dim: 'tone', target: 'formal', scope: 'context:chat+topic:investor', n: 6 }) },
    { type: 'pref', data: makePref({ dim: 'length', target: 'short', scope: '*', n: 15 }) },
  ]

  it('resolves the highest-scoring candidate', () => {
    const result = resolveDimension(entries, 'tone', undefined, undefined, NOW)
    expect(result.winner).not.toBeNull()
    expect(result.candidates).toBe(2)
    expect(result.action).toBe('use_winner')
  })

  it('prefers scoped match when context matches', () => {
    const result = resolveDimension(entries, 'tone', 'chat', 'investor', NOW)
    expect(result.winner).not.toBeNull()
    // Compound scope should score higher than global
    expect(result.winner!.scope).toBe('context:chat+topic:investor')
  })

  it('returns ask when no candidates', () => {
    const result = resolveDimension(entries, 'audience', undefined, undefined, NOW)
    expect(result.winner).toBeNull()
    expect(result.action).toBe('ask')
    expect(result.candidates).toBe(0)
  })

  it('detects instability when score < 0.4', () => {
    const weakEntries: LedgerEntry[] = [
      { type: 'pref', data: makePref({ dim: 'x', n: 1, ctd: 3, last: '2025-06-01', src: {} }) },
    ]
    const result = resolveDimension(weakEntries, 'x', undefined, undefined, NOW)
    expect(result.unstable).toBe(true)
    expect(result.action).toBe('ask')
  })

  it('filters out non-matching scoped entries', () => {
    const result = resolveDimension(entries, 'tone', 'code', undefined, NOW)
    // 'context:chat+topic:investor' should not match context:code
    expect(result.candidates).toBe(1)
    expect(result.winner!.scope).toBe('*')
  })
})

describe('matchMeaningMaps', () => {
  const entries: LedgerEntry[] = [
    {
      type: 'map', data: {
        trigger: 'make it shorter', pattern_type: 'rewrite_request',
        intent: ['reduce_length_40pct', 'remove_examples', 'keep_structure'],
        conf: 0.91, n: 8, scope: '*', last: '2026-04-03',
      },
    },
    {
      type: 'map', data: {
        trigger: 'more professional', pattern_type: 'style_override',
        intent: ['formal_register', 'remove_contractions'],
        conf: 0.85, n: 5, last: '2026-04-02',
      },
    },
  ]

  it('matches exact phrase', () => {
    const matches = matchMeaningMaps(entries, 'please make it shorter')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.trigger).toBe('make it shorter')
    expect(matches[0]!.intent).toContain('reduce_length_40pct')
  })

  it('case-insensitive matching', () => {
    const matches = matchMeaningMaps(entries, 'Make It Shorter please')
    expect(matches).toHaveLength(1)
  })

  it('returns empty for no match', () => {
    const matches = matchMeaningMaps(entries, 'add more detail')
    expect(matches).toHaveLength(0)
  })

  it('matches multiple maps', () => {
    const matches = matchMeaningMaps(entries, 'make it shorter and more professional')
    expect(matches).toHaveLength(2)
  })
})

describe('findDefaults', () => {
  const entries: LedgerEntry[] = [
    { type: 'pref', data: makePref() },
    {
      type: 'asn', data: {
        field: 'audience', default: 'developers',
        accuracy: 0.92, total: 25, correct: 23, last: '2026-04-05',
      },
    },
  ]

  it('extracts defaults from asn entries', () => {
    const defaults = findDefaults(entries)
    expect(defaults).toHaveLength(1)
    expect(defaults[0]!.field).toBe('audience')
    expect(defaults[0]!.default).toBe('developers')
    expect(defaults[0]!.accuracy).toBe(0.92)
  })

  it('ignores non-asn entries', () => {
    const defaults = findDefaults([{ type: 'pref', data: makePref() }])
    expect(defaults).toHaveLength(0)
  })
})

describe('createResolver', () => {
  const entries: LedgerEntry[] = [
    {
      type: 'meta', data: {
        profile: { tone: 'direct' }, signals: 47,
        by_ctx: { chat: 10, code: 30, cowork: 7 },
        by_out: { accepted: 30 },
        avg_conf: 0.82, avg_q: 3.2, updated: '2026-04-06',
      },
    },
    { type: 'pref', data: makePref({ dim: 'tone', target: 'direct', scope: '*', n: 20 }) },
    { type: 'pref', data: makePref({ dim: 'tone', target: 'formal', scope: 'context:chat+topic:investor', n: 6 }) },
    { type: 'pref', data: makePref({ dim: 'length', target: 'short', scope: '*', n: 15 }) },
    {
      type: 'map', data: {
        trigger: 'make it shorter', pattern_type: 'rewrite_request',
        intent: ['reduce_length_40pct'], conf: 0.91, n: 8, scope: '*', last: '2026-04-03',
      },
    },
    {
      type: 'asn', data: {
        field: 'audience', default: 'developers',
        accuracy: 0.92, total: 25, correct: 23, last: '2026-04-05',
      },
    },
  ]

  it('resolves a single dimension', () => {
    const resolver = createResolver({ entries, now: NOW })
    const result = resolver.resolve('tone')
    expect(result.winner).not.toBeNull()
    // Compound scope (1.0) beats global (0.3) even without filter
    expect(result.candidates).toBe(2)
  })

  it('resolves all dimensions', () => {
    const resolver = createResolver({ entries, now: NOW })
    const result = resolver.resolveAll()
    expect(Object.keys(result.dimensions)).toContain('tone')
    expect(Object.keys(result.dimensions)).toContain('length')
    expect(result.defaults).toHaveLength(1)
    expect(result.meta.entryCount).toBe(6)
  })

  it('resolves input with meaning map matching', () => {
    const resolver = createResolver({ entries, now: NOW })
    const result = resolver.resolveInput('make it shorter and direct')
    expect(result.meaningMaps).toHaveLength(1)
    expect(result.meaningMaps[0]!.intent).toContain('reduce_length_40pct')
    expect(result.dimensions['tone']!.winner).not.toBeNull()
  })

  it('respects context filter', () => {
    const resolver = createResolver({ entries, context: 'chat', topic: 'investor', now: NOW })
    const result = resolver.resolve('tone')
    expect(result.winner!.scope).toBe('context:chat+topic:investor')
  })

  it('returns entries copy', () => {
    const resolver = createResolver({ entries, now: NOW })
    const returned = resolver.entries()
    expect(returned).toHaveLength(entries.length)
    expect(returned).not.toBe(entries) // copy, not reference
  })
})
