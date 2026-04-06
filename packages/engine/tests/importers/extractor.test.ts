import { describe, it, expect } from 'vitest'
import { extractSignals } from '../../src/importers/extractor.js'
import type { Conversation } from '../../src/importers/types.js'

function makeConv(messages: Array<{ role: 'user' | 'assistant'; content: string }>, id = 'conv-1'): Conversation {
  return {
    id,
    messages: messages.map(m => ({ ...m })),
    platform: 'chatgpt',
  }
}

describe('extractSignals', () => {
  it('detects tone preference (direct)', () => {
    const convos = [
      makeConv([
        { role: 'user', content: 'Explain generics' },
        { role: 'assistant', content: 'Generics are a way to...' },
        { role: 'user', content: 'Be more direct, skip the preamble' },
      ]),
    ]
    const signals = extractSignals(convos)
    const toneSignal = signals.find(s => s.type === 'pref' && (s.data as Record<string, unknown>).dim === 'tone')
    expect(toneSignal).toBeDefined()
    expect((toneSignal!.data as Record<string, unknown>).target).toBe('direct')
  })

  it('detects length preference (shorter)', () => {
    const convos = [
      makeConv([
        { role: 'user', content: 'Write a summary' },
        { role: 'assistant', content: 'Here is a detailed summary...' },
        { role: 'user', content: 'Make it shorter' },
      ]),
    ]
    const signals = extractSignals(convos)
    const lengthSignal = signals.find(s => s.type === 'pref' && (s.data as Record<string, unknown>).dim === 'length')
    expect(lengthSignal).toBeDefined()
    expect((lengthSignal!.data as Record<string, unknown>).target).toBe('short')
  })

  it('detects meaning map (make it shorter)', () => {
    const convos = [
      makeConv([
        { role: 'user', content: 'make it shorter' },
      ]),
    ]
    const signals = extractSignals(convos)
    const mapSignal = signals.find(s => s.type === 'map')
    expect(mapSignal).toBeDefined()
    expect((mapSignal!.data as Record<string, unknown>).trigger).toBe('make it shorter')
    expect((mapSignal!.data as Record<string, unknown>).intent).toContain('reduce_length_40pct')
  })

  it('accumulates occurrences across conversations', () => {
    const convos = [
      makeConv([{ role: 'user', content: 'Too long, make it shorter' }], 'c1'),
      makeConv([{ role: 'user', content: 'This is too long' }], 'c2'),
      makeConv([{ role: 'user', content: 'Way too long again' }], 'c3'),
    ]
    const signals = extractSignals(convos)
    const lengthSignal = signals.find(s => s.type === 'pref' && (s.data as Record<string, unknown>).dim === 'length')
    expect(lengthSignal).toBeDefined()
    expect(lengthSignal!.occurrences).toBe(3)
  })

  it('assigns correct confidence based on occurrences', () => {
    // Create 10+ corrections for high confidence
    const convos = Array.from({ length: 12 }, (_, i) =>
      makeConv([{ role: 'user', content: 'Too short, make it longer' }], `c-${i}`)
    )
    const signals = extractSignals(convos)
    const lengthSignal = signals.find(s => s.type === 'pref' && (s.data as Record<string, unknown>).dim === 'length')
    expect(lengthSignal).toBeDefined()
    expect(lengthSignal!.confidence).toBe(1.0)
    expect(lengthSignal!.occurrences).toBe(12)
  })

  it('ignores assistant messages', () => {
    const convos = [
      makeConv([
        { role: 'assistant', content: 'I should be more direct next time' },
      ]),
    ]
    const signals = extractSignals(convos)
    expect(signals).toHaveLength(0)
  })

  it('returns empty for no corrections', () => {
    const convos = [
      makeConv([
        { role: 'user', content: 'What is the capital of France?' },
        { role: 'assistant', content: 'Paris' },
        { role: 'user', content: 'Thanks!' },
      ]),
    ]
    const signals = extractSignals(convos)
    expect(signals).toHaveLength(0)
  })

  it('detects format preference (bullets)', () => {
    const convos = [
      makeConv([
        { role: 'user', content: 'Can you use bullet points instead?' },
      ]),
    ]
    const signals = extractSignals(convos)
    const fmtSignal = signals.find(s => s.type === 'pref' && (s.data as Record<string, unknown>).dim === 'format')
    expect(fmtSignal).toBeDefined()
    expect((fmtSignal!.data as Record<string, unknown>).target).toBe('bullets')
  })

  it('handles empty conversations', () => {
    expect(extractSignals([])).toHaveLength(0)
  })

  it('sets platform in source', () => {
    const convos = [
      makeConv([{ role: 'user', content: 'Be more direct' }]),
    ]
    const signals = extractSignals(convos)
    expect(signals[0]!.source.platform).toBe('chatgpt')
  })
})
