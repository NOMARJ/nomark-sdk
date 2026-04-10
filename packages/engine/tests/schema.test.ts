import { describe, it, expect } from 'vitest'
import { SigPrefSchema, SigMapSchema, SigAsnSchema, SigMetaSchema, SigRubSchema, LedgerEntrySchema, ArchiveEventSchema } from '../src/schema.js'

describe('SigPrefSchema', () => {
  it('validates a correct preference entry', () => {
    const pref = {
      dim: 'tone', target: 'direct', w: 0.87, n: 20,
      src: { chat: 8, code: 12 }, ctd: 1, scope: '*',
      decay: 0.97, last: '2026-04-05',
    }
    expect(SigPrefSchema.safeParse(pref).success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const result = SigPrefSchema.safeParse({ dim: 'tone' })
    expect(result.success).toBe(false)
  })

  it('rejects weight out of range', () => {
    const pref = {
      dim: 'tone', target: 'direct', w: 1.5, n: 20,
      src: { chat: 8 }, ctd: 0, scope: '*', decay: 0.9, last: '2026-04-05',
    }
    expect(SigPrefSchema.safeParse(pref).success).toBe(false)
  })

  it('accepts staged flag', () => {
    const pref = {
      dim: 'tone', target: 'direct', w: 0.5, n: 1,
      src: { code: 1 }, ctd: 0, scope: '*', decay: 1.0,
      last: '2026-04-06', staged: true,
    }
    expect(SigPrefSchema.safeParse(pref).success).toBe(true)
  })

  it('accepts compound scope', () => {
    const pref = {
      dim: 'tone', target: 'formal', w: 0.82, n: 6,
      src: { chat: 6 }, ctd: 0, scope: 'context:chat+topic:investor',
      decay: 0.99, last: '2026-04-04',
    }
    expect(SigPrefSchema.safeParse(pref).success).toBe(true)
  })

  it('accepts source_quote and source_scope fields', () => {
    const pref = {
      dim: 'tone', target: 'direct', w: 0.9, n: 3,
      src: { chat: 3 }, ctd: 0, scope: '*', decay: 0.98,
      last: '2026-04-08',
      source_quote: 'just give it to me straight',
      source_scope: 'context:chat',
    }
    expect(SigPrefSchema.safeParse(pref).success).toBe(true)
  })
})

describe('SigMapSchema', () => {
  it('validates a meaning map entry', () => {
    const map = {
      trigger: 'make it shorter', pattern_type: 'rewrite_request' as const,
      intent: ['reduce_length_40pct', 'remove_examples', 'keep_structure'],
      conf: 0.91, n: 8, scope: '*', last: '2026-04-03',
    }
    expect(SigMapSchema.safeParse(map).success).toBe(true)
  })

  it('rejects invalid pattern_type', () => {
    const map = {
      trigger: 'test', pattern_type: 'invalid_type',
      intent: ['x'], conf: 0.5, n: 1, last: '2026-04-03',
    }
    expect(SigMapSchema.safeParse(map).success).toBe(false)
  })

  it('accepts custom pattern_type for user-authored maps', () => {
    const map = {
      trigger: 'always cite sources', pattern_type: 'custom' as const,
      intent: ['require_citation'], conf: 0.5, n: 1, scope: '*', last: '2026-04-10',
    }
    expect(SigMapSchema.safeParse(map).success).toBe(true)
  })
})

describe('SigAsnSchema', () => {
  it('validates an assumption entry', () => {
    const asn = {
      field: 'audience', default: 'developers',
      accuracy: 0.92, total: 25, correct: 23, last: '2026-04-05',
    }
    expect(SigAsnSchema.safeParse(asn).success).toBe(true)
  })
})

describe('SigMetaSchema', () => {
  it('validates a meta entry', () => {
    const meta = {
      profile: { tone: 'direct', verbosity: 'short' },
      signals: 47, by_ctx: { chat: 10, code: 30, cowork: 7 },
      by_out: { accepted: 30, edited: 5, corrected: 8, rejected: 2, abandoned: 2 },
      avg_conf: 0.82, avg_q: 3.2, updated: '2026-04-06',
    }
    expect(SigMetaSchema.safeParse(meta).success).toBe(true)
  })

  it('validates cold-start meta', () => {
    const meta = {
      profile: {}, signals: 0,
      by_ctx: { chat: 0, code: 0, cowork: 0 },
      by_out: { accepted: 0, edited: 0, corrected: 0, rejected: 0, abandoned: 0 },
      avg_conf: 0.5, avg_q: 1.5, updated: '2026-04-06',
    }
    expect(SigMetaSchema.safeParse(meta).success).toBe(true)
  })
})

describe('SigRubSchema', () => {
  it('validates a rubric entry', () => {
    const rub = {
      id: 'rub-001', fmt: 'report', stage: 'proven' as const,
      uses: 10, accepts: 8, avg_ed: 0.12,
      dims: { clarity: 0.3, completeness: 0.4, accuracy: 0.3 },
      min: 0.7, last: '2026-04-01',
    }
    expect(SigRubSchema.safeParse(rub).success).toBe(true)
  })
})

describe('LedgerEntrySchema', () => {
  it('discriminates by type', () => {
    const prefEntry = {
      type: 'pref' as const,
      data: {
        dim: 'tone', target: 'direct', w: 0.87, n: 20,
        src: { chat: 8, code: 12 }, ctd: 1, scope: '*',
        decay: 0.97, last: '2026-04-05',
      },
    }
    expect(LedgerEntrySchema.safeParse(prefEntry).success).toBe(true)
  })

  it('rejects unknown type', () => {
    const bad = { type: 'unknown', data: {} }
    expect(LedgerEntrySchema.safeParse(bad).success).toBe(false)
  })
})

describe('ArchiveEventSchema', () => {
  it('validates a full archive event', () => {
    const event = {
      id: 'sig-2026-04-06-abc',
      timestamp: '2026-04-06T10:00:00Z',
      context: 'code' as const,
      session_id: 'session-123',
      input_tier: 2,
      request_type: 'task' as const,
      outcome: 'accepted' as const,
      outcome_confidence: 0.95,
    }
    expect(ArchiveEventSchema.safeParse(event).success).toBe(true)
  })

  it('rejects invalid id prefix', () => {
    const event = {
      id: 'bad-prefix',
      timestamp: '2026-04-06T10:00:00Z',
      context: 'code' as const,
      session_id: 'session-123',
      input_tier: 2,
      outcome: 'accepted' as const,
    }
    expect(ArchiveEventSchema.safeParse(event).success).toBe(false)
  })

  it('rejects input_tier > 2', () => {
    const event = {
      id: 'sig-test',
      timestamp: '2026-04-06T10:00:00Z',
      context: 'code' as const,
      session_id: 'session-123',
      input_tier: 3,
      outcome: 'accepted' as const,
    }
    expect(ArchiveEventSchema.safeParse(event).success).toBe(false)
  })
})
