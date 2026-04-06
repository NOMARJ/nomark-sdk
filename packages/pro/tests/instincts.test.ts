import { describe, it, expect } from 'vitest'
import { createInstinctStore, captureInstinct, confirmInstinct, rejectInstinct, decayInstincts, findPromotionCandidates } from '../src/instincts.js'

describe('captureInstinct', () => {
  it('creates a pending instinct at 0.3 confidence', () => {
    const store = createInstinctStore()
    const after = captureInstinct(store, 'ins-001', 'audit before build', ['audit', 'build'], '2026-04-06')
    const ins = after.instincts.get('ins-001')!
    expect(ins.confidence).toBe(0.3)
    expect(ins.status).toBe('pending')
    expect(ins.observations).toBe(1)
  })
})

describe('confirmInstinct', () => {
  it('increases confidence by 0.3', () => {
    let store = createInstinctStore()
    store = captureInstinct(store, 'ins-001', 'test', ['tag'], '2026-04-06')
    store = confirmInstinct(store, 'ins-001')
    expect(store.instincts.get('ins-001')!.confidence).toBe(0.6)
  })

  it('promotes to proven at 0.7', () => {
    let store = createInstinctStore()
    store = captureInstinct(store, 'ins-001', 'test', ['tag'], '2026-04-06')
    store = confirmInstinct(store, 'ins-001') // 0.6
    store = confirmInstinct(store, 'ins-001') // 0.9
    expect(store.instincts.get('ins-001')!.status).toBe('proven')
  })

  it('caps at 1.0', () => {
    let store = createInstinctStore()
    store = captureInstinct(store, 'ins-001', 'test', ['tag'], '2026-04-06')
    store = confirmInstinct(store, 'ins-001')
    store = confirmInstinct(store, 'ins-001')
    store = confirmInstinct(store, 'ins-001')
    expect(store.instincts.get('ins-001')!.confidence).toBeLessThanOrEqual(1.0)
  })
})

describe('rejectInstinct', () => {
  it('decreases confidence by 0.4', () => {
    let store = createInstinctStore()
    store = captureInstinct(store, 'ins-001', 'test', ['tag'], '2026-04-06')
    store = rejectInstinct(store, 'ins-001')
    expect(store.instincts.get('ins-001')!.confidence).toBe(0)
    expect(store.instincts.get('ins-001')!.status).toBe('rejected')
  })
})

describe('decayInstincts', () => {
  it('decays by 0.1 per 30 days', () => {
    let store = createInstinctStore()
    store = captureInstinct(store, 'ins-001', 'test', ['tag'], '2026-04-06')
    store = confirmInstinct(store, 'ins-001') // 0.6
    store = decayInstincts(store, 30)
    expect(store.instincts.get('ins-001')!.confidence).toBeCloseTo(0.5, 2)
  })

  it('rejects instincts below 0.2', () => {
    let store = createInstinctStore()
    store = captureInstinct(store, 'ins-001', 'test', ['tag'], '2026-04-06')
    store = decayInstincts(store, 60) // 0.3 - 0.2 = 0.1
    expect(store.instincts.get('ins-001')!.status).toBe('rejected')
  })

  it('skips promoted instincts', () => {
    const store = createInstinctStore()
    const instincts = new Map(store.instincts)
    instincts.set('ins-p', {
      id: 'ins-p', pattern: 'promoted', tags: [], confidence: 0.9,
      observations: 5, status: 'promoted', createdAt: '2026-04-01',
    })
    const after = decayInstincts({ instincts }, 90)
    expect(after.instincts.get('ins-p')!.confidence).toBe(0.9)
  })
})

describe('findPromotionCandidates', () => {
  it('finds clusters of 3+ proven instincts', () => {
    const store = createInstinctStore()
    const instincts = new Map(store.instincts)
    for (let i = 0; i < 3; i++) {
      instincts.set(`ins-${i}`, {
        id: `ins-${i}`, pattern: `pattern ${i}`, tags: ['audit', 'build'],
        confidence: 0.8, observations: 3, status: 'proven', createdAt: '2026-04-06',
      })
    }
    const candidates = findPromotionCandidates({ instincts })
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.some(c => c.tag === 'audit')).toBe(true)
  })

  it('returns empty when < 3 proven', () => {
    const store = createInstinctStore()
    const instincts = new Map(store.instincts)
    instincts.set('ins-1', {
      id: 'ins-1', pattern: 'test', tags: ['audit'],
      confidence: 0.8, observations: 3, status: 'proven', createdAt: '2026-04-06',
    })
    expect(findPromotionCandidates({ instincts })).toHaveLength(0)
  })
})
