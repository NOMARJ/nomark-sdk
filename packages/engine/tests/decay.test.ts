import { describe, it, expect } from 'vitest'
import { computeDecay, effectiveWeight } from '../src/decay.js'

const TODAY = new Date('2026-04-06')

describe('computeDecay', () => {
  it('returns ~1.0 for today', () => {
    const decay = computeDecay('2026-04-06', 0, 0, false, TODAY)
    expect(decay).toBeCloseTo(1.0, 2)
  })

  it('decays over 30 days', () => {
    const decay = computeDecay('2026-03-07', 0, 0, false, TODAY)
    expect(decay).toBeLessThan(1.0)
    expect(decay).toBeGreaterThan(0.9)
  })

  it('decays over 180 days to low value', () => {
    const decay = computeDecay('2025-10-08', 0, 0, false, TODAY)
    expect(decay).toBeLessThan(0.9)
    expect(decay).toBeGreaterThanOrEqual(0.1)
  })

  it('applies contradiction acceleration when recentContradictions >= 2', () => {
    const normal = computeDecay('2026-03-07', 0, 0, false, TODAY)
    const accelerated = computeDecay('2026-03-07', 5, 2, false, TODAY)
    expect(accelerated).toBeLessThan(normal)
    expect(accelerated).toBeCloseTo(normal * 0.85, 2)
  })

  it('does not accelerate with < 2 recent contradictions', () => {
    const normal = computeDecay('2026-03-07', 5, 1, false, TODAY)
    const same = computeDecay('2026-03-07', 0, 0, false, TODAY)
    expect(normal).toBeCloseTo(same, 3)
  })

  it('applies reinforcement recovery', () => {
    const normal = computeDecay('2026-03-07', 0, 0, false, TODAY)
    const reinforced = computeDecay('2026-03-07', 0, 0, true, TODAY)
    expect(reinforced).toBeGreaterThan(normal)
    expect(reinforced).toBeCloseTo(Math.min(1.0, normal * 1.1), 2)
  })

  it('caps reinforcement at 1.0', () => {
    const decay = computeDecay('2026-04-06', 0, 0, true, TODAY)
    expect(decay).toBeLessThanOrEqual(1.0)
  })

  it('never goes below floor of 0.1', () => {
    const decay = computeDecay('2020-01-01', 100, 50, false, TODAY)
    expect(decay).toBeGreaterThanOrEqual(0.1)
  })

  it('applies both contradiction and reinforcement', () => {
    const decay = computeDecay('2026-03-07', 5, 3, true, TODAY)
    const base = Math.max(0.1, Math.pow(0.98, 30 / 30))
    const withCtd = Math.max(0.1, base * 0.85)
    const withReinf = Math.min(1.0, withCtd * 1.1)
    expect(decay).toBeCloseTo(withReinf, 2)
  })
})

describe('effectiveWeight', () => {
  it('multiplies weight by decay', () => {
    expect(effectiveWeight(0.9, 0.95)).toBe(0.855)
  })

  it('rounds to 3 decimal places', () => {
    expect(effectiveWeight(0.333, 0.777)).toBe(0.259)
  })

  it('returns 0 when weight is 0', () => {
    expect(effectiveWeight(0, 0.95)).toBe(0)
  })
})
