import { describe, it, expect } from 'vitest'
import { runMigration } from '../../src/importers/pipeline.js'
import type { Conversation, LedgerEntry } from '../../src/index.js'

function makeConvos(corrections: string[], platform: 'chatgpt' | 'claude' = 'chatgpt'): Conversation[] {
  return corrections.map((content, i) => ({
    id: `conv-${i}`,
    messages: [
      { role: 'user' as const, content: 'do something' },
      { role: 'assistant' as const, content: 'here is the result...' },
      { role: 'user' as const, content },
    ],
    platform,
  }))
}

describe('runMigration', () => {
  it('returns dry-run report by default', () => {
    const convos = makeConvos([
      'too long', 'too long', 'too long',
    ])
    const report = runMigration(convos)
    expect(report.dryRun).toBe(true)
    expect(report.ledgerEntries).toHaveLength(0)
    expect(report.conversationsAnalyzed).toBe(3)
  })

  it('extracts signals from conversations with corrections', () => {
    const convos = makeConvos([
      'make it shorter',
      'make it shorter please',
      'can you make it shorter',
    ])
    const report = runMigration(convos)
    expect(report.signalsExtracted).toBeGreaterThan(0)
  })

  it('applies value test — drops signals with < 3 occurrences', () => {
    const convos = makeConvos([
      'use bullet points',
      'use bullet points',
    ])
    const report = runMigration(convos)
    // Only 2 occurrences — should not promote
    expect(report.signalsPromoted).toBe(0)
  })

  it('promotes signals with 3+ occurrences', () => {
    const convos = makeConvos([
      'too long', 'too long', 'too long',
    ])
    const report = runMigration(convos)
    expect(report.signalsPromoted).toBeGreaterThan(0)
  })

  it('assigns confidence bands correctly', () => {
    const convos = makeConvos(Array.from({ length: 12 }, () => 'too long'))
    const report = runMigration(convos)
    expect(report.byConfidence.high).toBeGreaterThan(0)
  })

  it('deduplicates against existing ledger', () => {
    const convos = makeConvos([
      'too long', 'too long', 'too long',
    ])
    const existing: LedgerEntry[] = [{
      type: 'pref',
      data: {
        dim: 'length', target: 'short', w: 0.9, n: 20,
        src: { chat: 20 }, ctd: 0, scope: '*',
        decay: 0.99, last: '2026-04-05',
      },
    }]
    const report = runMigration(convos, { existingLedger: existing })
    // Should be deduped — length::short already exists
    const lengthSignals = report.signals.filter(
      s => s.type === 'pref' && (s.data as Record<string, unknown>).dim === 'length'
    )
    expect(lengthSignals).toHaveLength(0)
  })

  it('produces ledger entries when not dry-run', () => {
    const convos = makeConvos([
      'too long', 'too long', 'too long',
    ])
    const report = runMigration(convos, { dryRun: false })
    expect(report.dryRun).toBe(false)
    expect(report.ledgerEntries.length).toBeGreaterThan(0)
  })

  it('respects maxConversations limit', () => {
    const convos = makeConvos(Array.from({ length: 200 }, () => 'too long'))
    const report = runMigration(convos, { maxConversations: 100 })
    expect(report.conversationsAnalyzed).toBe(100)
  })

  it('handles conversations with no corrections', () => {
    const convos: Conversation[] = [{
      id: 'conv-simple',
      messages: [
        { role: 'user', content: 'What is 2+2?' },
        { role: 'assistant', content: '4' },
        { role: 'user', content: 'Thanks!' },
      ],
      platform: 'chatgpt',
    }]
    const report = runMigration(convos)
    expect(report.signalsExtracted).toBe(0)
    expect(report.signalsPromoted).toBe(0)
  })

  it('sets platform from conversations', () => {
    const convos = makeConvos(['too long', 'too long', 'too long'], 'claude')
    const report = runMigration(convos)
    expect(report.platform).toBe('claude')
  })

  it('stages low-confidence signals', () => {
    const convos = makeConvos(['too long', 'too long', 'too long']) // 3 = low
    const report = runMigration(convos, { dryRun: false })
    const staged = report.ledgerEntries.filter(
      e => e.type === 'pref' && (e.data as Record<string, unknown>).staged === true
    )
    expect(staged.length).toBeGreaterThan(0)
  })
})
