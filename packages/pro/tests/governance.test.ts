import { describe, it, expect } from 'vitest'
import { createLifecycle, advanceStage, checkTrustGate, recordArtifact, recordVerification, isComplete, currentStageName, CODE_LIFECYCLE } from '../src/governance.js'

const TS = '2026-04-06T10:00:00Z'

describe('createLifecycle', () => {
  it('starts at first stage', () => {
    const instance = createLifecycle(CODE_LIFECYCLE, TS)
    expect(currentStageName(instance)).toBe('discover')
    expect(instance.stageStatuses[0]).toBe('active')
    expect(instance.stageStatuses[1]).toBe('pending')
  })
})

describe('checkTrustGate', () => {
  it('passes when no gate', () => {
    const instance = createLifecycle(CODE_LIFECYCLE, TS)
    expect(checkTrustGate(instance, 0).pass).toBe(true)
  })

  it('blocks when trust below gate', () => {
    let instance = createLifecycle(CODE_LIFECYCLE, TS)
    // Advance to 'build' stage (index 2, trust gate 0.5)
    instance = advanceStage(instance, 1.0, TS)
    instance = advanceStage(instance, 1.0, TS)
    expect(currentStageName(instance)).toBe('build')
    expect(checkTrustGate(instance, 0.3).pass).toBe(false)
    expect(checkTrustGate(instance, 0.5).pass).toBe(true)
  })
})

describe('advanceStage', () => {
  it('advances to next stage', () => {
    const instance = createLifecycle(CODE_LIFECYCLE, TS)
    const advanced = advanceStage(instance, 1.0, TS)
    expect(currentStageName(advanced)).toBe('plan')
    expect(advanced.stageStatuses[0]).toBe('completed')
    expect(advanced.stageStatuses[1]).toBe('active')
  })

  it('blocks on trust gate failure', () => {
    let instance = createLifecycle(CODE_LIFECYCLE, TS)
    instance = advanceStage(instance, 1.0, TS) // discover → plan
    instance = advanceStage(instance, 1.0, TS) // plan → build (gate 0.5)
    // Try build → verify with low trust
    const blocked = advanceStage(instance, 0.3, TS)
    expect(currentStageName(blocked)).toBe('build') // didn't advance
    expect(blocked.auditTrail.some(e => e.type === 'gate_check')).toBe(true)
  })

  it('records in audit trail', () => {
    const instance = createLifecycle(CODE_LIFECYCLE, TS)
    const advanced = advanceStage(instance, 1.0, TS)
    expect(advanced.auditTrail.length).toBeGreaterThan(1)
    expect(advanced.auditTrail.at(-1)!.type).toBe('stage_advance')
  })
})

describe('recordArtifact', () => {
  it('stores artifact by stage', () => {
    const instance = createLifecycle(CODE_LIFECYCLE, TS)
    const after = recordArtifact(instance, 'plan', 'plan.md')
    expect(after.artifacts.get('plan')).toEqual(['plan.md'])
  })
})

describe('recordVerification', () => {
  it('adds to audit trail', () => {
    const instance = createLifecycle(CODE_LIFECYCLE, TS)
    const after = recordVerification(instance, 'US-001', 'npm test', 0, '12 tests passed', TS)
    const entry = after.auditTrail.at(-1)!
    expect(entry.type).toBe('verification')
    expect(entry.details['storyId']).toBe('US-001')
    expect(entry.details['exitCode']).toBe(0)
  })
})

describe('isComplete', () => {
  it('returns false when stages remain', () => {
    const instance = createLifecycle(CODE_LIFECYCLE, TS)
    expect(isComplete(instance)).toBe(false)
  })

  it('returns true when all completed', () => {
    let instance = createLifecycle(CODE_LIFECYCLE, TS)
    for (let i = 0; i < 4; i++) {
      instance = advanceStage(instance, 2.0, TS)
    }
    // Last stage needs to be marked completed
    const statuses = [...instance.stageStatuses]
    statuses[instance.currentStage] = 'completed'
    instance = { ...instance, stageStatuses: statuses }
    expect(isComplete(instance)).toBe(true)
  })
})
