import { describe, it, expect } from 'vitest'
import { classifyField, evaluateGate, getCriticalFields } from '../src/critical-gate.js'

describe('classifyField', () => {
  it('classifies inferable fields as tier 1', () => {
    const result = classifyField('tone', 'creative')
    expect(result.tier).toBe(1)
    expect(result.tierName).toBe('inferable')
  })

  it('classifies defaultable fields as tier 2', () => {
    const result = classifyField('audience', 'creative')
    expect(result.tier).toBe(2)
    expect(result.tierName).toBe('defaultable')
  })

  it('classifies critical_ask fields as tier 3', () => {
    const result = classifyField('content_facts', 'creative')
    expect(result.tier).toBe(3)
    expect(result.tierName).toBe('critical_ask')
  })

  it('defaults unknown fields to critical_ask', () => {
    const result = classifyField('unknown_field', 'creative')
    expect(result.tier).toBe(3)
  })

  it('defaults unknown request types to critical_ask', () => {
    const result = classifyField('anything', 'unknown_type')
    expect(result.tier).toBe(3)
  })

  it('supports custom schemas', () => {
    const custom = {
      report: {
        inferable: ['format', 'length'],
        defaultable: ['audience'],
        critical_ask: ['data_source', 'date_range'],
      },
    }
    expect(classifyField('format', 'report', custom).tier).toBe(1)
    expect(classifyField('data_source', 'report', custom).tier).toBe(3)
  })
})

describe('evaluateGate', () => {
  it('returns action for each field', () => {
    const results = evaluateGate(
      ['tone', 'audience', 'content_facts'],
      'creative',
    )
    expect(results).toHaveLength(3)
    expect(results[0]!.action).toBe('infer')
    expect(results[0]!.blocked).toBe(false)
    expect(results[1]!.action).toBe('default')
    expect(results[1]!.blocked).toBe(false)
    expect(results[2]!.action).toBe('ask')
    expect(results[2]!.blocked).toBe(true)
  })

  it('blocks critical fields with reason', () => {
    const results = evaluateGate(['recipient'], 'communication')
    expect(results[0]!.blocked).toBe(true)
    expect(results[0]!.reason).toContain('critical_ask')
  })
})

describe('getCriticalFields', () => {
  it('returns critical fields for creative', () => {
    const fields = getCriticalFields('creative')
    expect(fields).toContain('content_facts')
    expect(fields).toContain('claims')
    expect(fields).toContain('figures')
  })

  it('returns critical fields for communication', () => {
    const fields = getCriticalFields('communication')
    expect(fields).toContain('recipient')
    expect(fields).toContain('send_intent')
  })

  it('returns empty for unknown type', () => {
    expect(getCriticalFields('unknown')).toEqual([])
  })
})
