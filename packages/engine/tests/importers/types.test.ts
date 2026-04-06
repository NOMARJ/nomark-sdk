import { describe, it, expect } from 'vitest'
import { getConfidenceBand, getConfidenceWeight } from '../../src/importers/types.js'

describe('getConfidenceBand', () => {
  it('returns high for 10+ occurrences', () => {
    expect(getConfidenceBand(10)).toBe('high')
    expect(getConfidenceBand(50)).toBe('high')
  })

  it('returns medium for 5-9', () => {
    expect(getConfidenceBand(5)).toBe('medium')
    expect(getConfidenceBand(9)).toBe('medium')
  })

  it('returns low for 3-4', () => {
    expect(getConfidenceBand(3)).toBe('low')
    expect(getConfidenceBand(4)).toBe('low')
  })

  it('returns low for < 3', () => {
    expect(getConfidenceBand(1)).toBe('low')
    expect(getConfidenceBand(0)).toBe('low')
  })
})

describe('getConfidenceWeight', () => {
  it('returns 1.0 for high', () => expect(getConfidenceWeight('high')).toBe(1.0))
  it('returns 0.8 for medium', () => expect(getConfidenceWeight('medium')).toBe(0.8))
  it('returns 0.6 for low', () => expect(getConfidenceWeight('low')).toBe(0.6))
})
