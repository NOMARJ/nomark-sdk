import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { configCommand, loadConfig, saveConfig } from '../../src/cli/config.js'
import { profileCommand } from '../../src/cli/profile.js'
import { reviewCommand } from '../../src/cli/review.js'
import { writeLedger } from '../../src/ledger.js'
import type { LedgerEntry } from '../../src/schema.js'

let tmpDir: string
let originalHome: string | undefined

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-test-'))
  originalHome = process.env['HOME']
  process.env['HOME'] = tmpDir
})

afterEach(() => {
  process.env['HOME'] = originalHome
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('configCommand', () => {
  it('saves model config', () => {
    configCommand({ model: 'claude' })
    const config = loadConfig()
    expect(config.model).toBe('claude')
  })

  it('saves api key', () => {
    configCommand({ 'api-key': 'sk-test-1234' })
    const config = loadConfig()
    expect(config.apiKey).toBe('sk-test-1234')
  })

  it('merges with existing config', () => {
    saveConfig({ model: 'gpt' })
    configCommand({ 'api-key': 'sk-new' })
    const config = loadConfig()
    expect(config.model).toBe('gpt')
    expect(config.apiKey).toBe('sk-new')
  })
})

describe('profileCommand', () => {
  it('handles missing ledger gracefully', () => {
    // Should not throw
    profileCommand({ ledger: path.join(tmpDir, 'nonexistent.jsonl') })
  })

  it('handles empty ledger gracefully', () => {
    const ledgerPath = path.join(tmpDir, 'ledger.jsonl')
    fs.writeFileSync(ledgerPath, '')
    profileCommand({ ledger: ledgerPath })
  })

  it('displays profile from ledger with preferences', () => {
    const ledgerPath = path.join(tmpDir, 'ledger.jsonl')
    const entries: LedgerEntry[] = [
      {
        type: 'meta', data: {
          profile: { tone: 'direct' }, signals: 10,
          by_ctx: { code: 10 }, by_out: { accepted: 8 },
          avg_conf: 0.8, avg_q: 3.0, updated: '2026-04-06',
        },
      },
      {
        type: 'pref', data: {
          dim: 'tone', target: 'direct', w: 0.87, n: 20,
          src: { code: 20 }, ctd: 0, scope: '*',
          decay: 0.97, last: '2026-04-05',
        },
      },
    ]
    fs.writeFileSync(ledgerPath, writeLedger(entries))
    // Should not throw, just display
    profileCommand({ ledger: ledgerPath })
  })
})

describe('reviewCommand', () => {
  it('handles missing ledger', () => {
    reviewCommand({ ledger: path.join(tmpDir, 'nope.jsonl') })
  })

  it('shows staged signals', () => {
    const ledgerPath = path.join(tmpDir, 'ledger.jsonl')
    const entries: LedgerEntry[] = [
      {
        type: 'pref', data: {
          dim: 'tone', target: 'direct', w: 0.3, n: 3,
          src: { chat: 3 }, ctd: 0, scope: '*',
          decay: 1.0, last: '2026-04-06', staged: true,
        },
      },
    ]
    fs.writeFileSync(ledgerPath, writeLedger(entries))
    // Should not throw
    reviewCommand({ ledger: ledgerPath })
  })

  it('reports clean when no staged signals', () => {
    const ledgerPath = path.join(tmpDir, 'ledger.jsonl')
    const entries: LedgerEntry[] = [
      {
        type: 'pref', data: {
          dim: 'tone', target: 'direct', w: 0.9, n: 20,
          src: { code: 20 }, ctd: 0, scope: '*',
          decay: 0.99, last: '2026-04-05',
        },
      },
    ]
    fs.writeFileSync(ledgerPath, writeLedger(entries))
    reviewCommand({ ledger: ledgerPath })
  })
})
