import { describe, it, expect } from 'vitest'
import { createTrustContract, recordBreach, recordVerification, recordCommend, getAutonomyLevel } from '../src/trust.js'

describe('getAutonomyLevel', () => {
  it('returns probation for < 0.2', () => expect(getAutonomyLevel(0.1)).toBe('probation'))
  it('returns restricted for 0.2-0.5', () => expect(getAutonomyLevel(0.3)).toBe('restricted'))
  it('returns supervised for 0.5-1.0', () => expect(getAutonomyLevel(0.7)).toBe('supervised'))
  it('returns trusted for 1.0-1.5', () => expect(getAutonomyLevel(1.2)).toBe('trusted'))
  it('returns full for >= 1.5', () => expect(getAutonomyLevel(1.8)).toBe('full'))
})

describe('createTrustContract', () => {
  it('starts at 0.5 by default', () => {
    const trust = createTrustContract()
    expect(trust.score).toBe(0.5)
    expect(trust.level).toBe('supervised')
  })

  it('accepts custom initial score', () => {
    const trust = createTrustContract(1.0)
    expect(trust.score).toBe(1.0)
    expect(trust.level).toBe('trusted')
  })
})

describe('recordBreach', () => {
  it('applies S0 penalty (-0.01)', () => {
    const trust = createTrustContract(1.0)
    const after = recordBreach(trust, { severity: 'S0', description: 'formatting', timestamp: '2026-04-06T10:00:00Z' })
    expect(after.score).toBe(0.99)
    expect(after.breaches.S0).toBe(1)
  })

  it('applies S2 penalty (-0.15)', () => {
    const trust = createTrustContract(1.0)
    const after = recordBreach(trust, { severity: 'S2', description: 'wrong output', timestamp: '2026-04-06T10:00:00Z' })
    expect(after.score).toBe(0.85)
  })

  it('S4 floors to 0', () => {
    const trust = createTrustContract(1.5)
    const after = recordBreach(trust, { severity: 'S4', description: 'data exposure', timestamp: '2026-04-06T10:00:00Z' })
    expect(after.score).toBe(0)
    expect(after.level).toBe('probation')
  })

  it('never goes below 0', () => {
    const trust = createTrustContract(0.02)
    const after = recordBreach(trust, { severity: 'S2', description: 'test', timestamp: '2026-04-06T10:00:00Z' })
    expect(after.score).toBe(0)
  })

  it('records in history', () => {
    const trust = createTrustContract()
    const after = recordBreach(trust, { severity: 'S1', description: 'skipped verification', timestamp: '2026-04-06T10:00:00Z' })
    expect(after.history).toHaveLength(1)
    expect(after.history[0]!.delta).toBe(-0.05)
  })
})

describe('recordVerification', () => {
  it('earns +0.02 for trivial', () => {
    const trust = createTrustContract(0.5)
    const after = recordVerification(trust, { scope: 'trivial', storyId: 'US-001', timestamp: '2026-04-06T10:00:00Z' })
    expect(after.score).toBe(0.52)
    expect(after.storiesVerified).toBe(1)
  })

  it('earns +0.05 for moderate', () => {
    const trust = createTrustContract(0.5)
    const after = recordVerification(trust, { scope: 'moderate', storyId: 'US-002', timestamp: '2026-04-06T10:00:00Z' })
    expect(after.score).toBe(0.55)
  })

  it('earns +0.10 for complex', () => {
    const trust = createTrustContract(0.5)
    const after = recordVerification(trust, { scope: 'complex', storyId: 'US-003', timestamp: '2026-04-06T10:00:00Z' })
    expect(after.score).toBe(0.6)
  })
})

describe('recordCommend', () => {
  it('adds +0.20', () => {
    const trust = createTrustContract(1.0)
    const after = recordCommend(trust, 'excellent debugging', '2026-04-06T10:00:00Z')
    expect(after.score).toBe(1.2)
    expect(after.commends).toBe(1)
  })
})
