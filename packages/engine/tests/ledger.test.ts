import { describe, it, expect } from 'vitest'
import { parseLedgerLine, formatLedgerLine, parseLedger, writeLedger, countByType, checkCapacity, estimateTokens, ENTRY_CAPS, TOTAL_CAP } from '../src/ledger.js'
import type { LedgerEntry } from '../src/schema.js'

const SAMPLE_PREF: LedgerEntry = {
  type: 'pref',
  data: {
    dim: 'tone', target: 'direct', w: 0.87, n: 20,
    src: { chat: 8, code: 12 }, ctd: 1, scope: '*',
    decay: 0.97, last: '2026-04-05',
  },
}

const SAMPLE_META: LedgerEntry = {
  type: 'meta',
  data: {
    profile: { tone: 'direct' }, signals: 47,
    by_ctx: { chat: 10, code: 30, cowork: 7 },
    by_out: { accepted: 30, edited: 5, corrected: 8, rejected: 2, abandoned: 2 },
    avg_conf: 0.82, avg_q: 3.2, updated: '2026-04-06',
  },
}

const SAMPLE_MAP: LedgerEntry = {
  type: 'map',
  data: {
    trigger: 'make it shorter', pattern_type: 'rewrite_request',
    intent: ['reduce_length_40pct', 'remove_examples'],
    conf: 0.91, n: 8, scope: '*', last: '2026-04-03',
  },
}

const SAMPLE_ASN: LedgerEntry = {
  type: 'asn',
  data: {
    field: 'audience', default: 'developers',
    accuracy: 0.92, total: 25, correct: 23, last: '2026-04-05',
  },
}

describe('parseLedgerLine', () => {
  it('parses a valid pref line', () => {
    const line = `[sig:pref] ${JSON.stringify(SAMPLE_PREF.data)}`
    const result = parseLedgerLine(line)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('pref')
    expect(result!.data).toEqual(SAMPLE_PREF.data)
  })

  it('parses a valid meta line', () => {
    const line = `[sig:meta] ${JSON.stringify(SAMPLE_META.data)}`
    const result = parseLedgerLine(line)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('meta')
  })

  it('returns null for empty lines', () => {
    expect(parseLedgerLine('')).toBeNull()
    expect(parseLedgerLine('  ')).toBeNull()
  })

  it('returns null for lines without prefix', () => {
    expect(parseLedgerLine('just some text')).toBeNull()
    expect(parseLedgerLine('{"json": true}')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseLedgerLine('[sig:pref] not-json')).toBeNull()
  })

  it('returns null for unknown type with invalid data', () => {
    expect(parseLedgerLine('[sig:unknown] {}')).toBeNull()
  })
})

describe('formatLedgerLine', () => {
  it('formats a pref entry', () => {
    const line = formatLedgerLine(SAMPLE_PREF)
    expect(line).toMatch(/^\[sig:pref\] \{/)
    expect(line).toContain('"dim":"tone"')
  })

  it('roundtrips with parseLedgerLine', () => {
    const line = formatLedgerLine(SAMPLE_PREF)
    const parsed = parseLedgerLine(line)
    expect(parsed).toEqual(SAMPLE_PREF)
  })
})

describe('parseLedger', () => {
  it('parses multi-line JSONL', () => {
    const content = [
      formatLedgerLine(SAMPLE_META),
      formatLedgerLine(SAMPLE_PREF),
      formatLedgerLine(SAMPLE_MAP),
      '',
    ].join('\n')

    const entries = parseLedger(content)
    expect(entries).toHaveLength(3)
    expect(entries[0]!.type).toBe('meta')
    expect(entries[1]!.type).toBe('pref')
    expect(entries[2]!.type).toBe('map')
  })

  it('skips malformed lines', () => {
    const content = [
      formatLedgerLine(SAMPLE_META),
      'garbage line',
      formatLedgerLine(SAMPLE_PREF),
    ].join('\n')

    const entries = parseLedger(content)
    expect(entries).toHaveLength(2)
  })

  it('handles empty content', () => {
    expect(parseLedger('')).toHaveLength(0)
  })
})

describe('writeLedger', () => {
  it('serializes entries to JSONL', () => {
    const entries = [SAMPLE_META, SAMPLE_PREF]
    const content = writeLedger(entries)
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^\[sig:meta\]/)
    expect(lines[1]).toMatch(/^\[sig:pref\]/)
  })

  it('ends with newline', () => {
    const content = writeLedger([SAMPLE_META])
    expect(content.endsWith('\n')).toBe(true)
  })

  it('roundtrips with parseLedger', () => {
    const original = [SAMPLE_META, SAMPLE_PREF, SAMPLE_MAP, SAMPLE_ASN]
    const content = writeLedger(original)
    const parsed = parseLedger(content)
    expect(parsed).toEqual(original)
  })
})

describe('countByType', () => {
  it('counts correctly', () => {
    const entries = [SAMPLE_META, SAMPLE_PREF, SAMPLE_PREF, SAMPLE_MAP, SAMPLE_ASN]
    const counts = countByType(entries)
    expect(counts).toEqual({ meta: 1, pref: 2, map: 1, asn: 1, rub: 0 })
  })
})

describe('checkCapacity', () => {
  it('returns empty for valid ledger', () => {
    expect(checkCapacity([SAMPLE_META, SAMPLE_PREF])).toEqual([])
  })

  it('detects total cap violation', () => {
    const entries: LedgerEntry[] = [SAMPLE_META]
    for (let i = 0; i < TOTAL_CAP; i++) {
      entries.push({ ...SAMPLE_PREF, data: { ...SAMPLE_PREF.data, dim: `dim-${i}` } })
    }
    const violations = checkCapacity(entries)
    expect(violations.some(v => v.includes('total'))).toBe(true)
  })

  it('detects per-type cap violation', () => {
    const entries: LedgerEntry[] = []
    for (let i = 0; i < ENTRY_CAPS.meta + 1; i++) {
      entries.push(SAMPLE_META)
    }
    const violations = checkCapacity(entries)
    expect(violations.some(v => v.includes('meta'))).toBe(true)
  })
})

describe('estimateTokens', () => {
  it('estimates 75 tokens per entry', () => {
    expect(estimateTokens([SAMPLE_META, SAMPLE_PREF])).toBe(150)
  })

  it('estimates 0 for empty', () => {
    expect(estimateTokens([])).toBe(0)
  })
})
