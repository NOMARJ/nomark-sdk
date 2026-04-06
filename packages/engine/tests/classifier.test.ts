import { describe, it, expect } from 'vitest'
import { classify, type ClassifierRule } from '../src/classifier.js'

describe('classify — Tier 0 (pass-through)', () => {
  it('classifies confirmations', () => {
    for (const input of ['y', 'yes', 'no', 'n', 'ok', 'done', 'skip', 'cancel', 'approve', 'reject', 'confirm']) {
      expect(classify(input).tier).toBe(0)
    }
  })

  it('classifies numeric selections', () => {
    expect(classify('3').tier).toBe(0)
    expect(classify('42').tier).toBe(0)
  })

  it('classifies JSON data', () => {
    expect(classify('{"key": "value"}').tier).toBe(0)
    expect(classify('[1, 2, 3]').tier).toBe(0)
  })

  it('classifies exit signals', () => {
    expect(classify('exit').tier).toBe(0)
    expect(classify('quit').tier).toBe(0)
  })

  it('classifies commit hashes', () => {
    expect(classify('a1b2c3d4').tier).toBe(0)
    expect(classify('60e2330e9abc1234567890abcdef1234567890ab').tier).toBe(0)
  })

  it('classifies empty input as tier 0', () => {
    expect(classify('').tier).toBe(0)
    expect(classify('   ').tier).toBe(0)
  })
})

describe('classify — Tier 1 (routing)', () => {
  it('classifies skill invocations', () => {
    expect(classify('/commit').tier).toBe(1)
    expect(classify('/autopilot tasks/prd.md').tier).toBe(1)
  })

  it('classifies continuations', () => {
    for (const input of ['continue', 'go ahead', 'proceed', 'next', 'keep going', 'resume']) {
      expect(classify(input).tier).toBe(1)
    }
  })

  it('classifies corrections', () => {
    expect(classify('no, not that').tier).toBe(1)
    expect(classify('actually, I meant the other file').tier).toBe(1)
    expect(classify('wait').tier).toBe(1)
    expect(classify('scratch that').tier).toBe(1)
    expect(classify('nevermind').tier).toBe(1)
  })

  it('classifies letter selections', () => {
    expect(classify('a').tier).toBe(1)
    expect(classify('b').tier).toBe(1)
  })
})

describe('classify — Tier 2 (extraction)', () => {
  it('classifies substantive natural language', () => {
    expect(classify('make the landing page better').tier).toBe(2)
    expect(classify('refactor the auth middleware to use JWT').tier).toBe(2)
    expect(classify('write a function that validates email addresses').tier).toBe(2)
  })

  it('classifies questions as tier 2', () => {
    expect(classify('how does the payment flow work?').tier).toBe(2)
    expect(classify('what is the current test coverage?').tier).toBe(2)
  })

  it('returns substantive_input reason', () => {
    const result = classify('build a REST API for user management')
    expect(result.tier).toBe(2)
    expect(result.reason).toBe('substantive_input')
  })
})

describe('classify — custom rules', () => {
  it('custom rules take priority over defaults', () => {
    const custom: ClassifierRule[] = [
      { tier: 2, test: (s) => s.startsWith('/custom'), reason: 'custom_extraction' },
    ]
    const result = classify('/custom command', custom)
    expect(result.tier).toBe(2)
    expect(result.reason).toBe('custom_extraction')
  })

  it('falls through to defaults when custom rules dont match', () => {
    const custom: ClassifierRule[] = [
      { tier: 2, test: () => false, reason: 'never_matches' },
    ]
    expect(classify('yes', custom).tier).toBe(0)
  })
})
