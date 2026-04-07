import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CLI = path.resolve(import.meta.dirname, '..', 'dist', 'index.js')

function run(args = [], cwd) {
  return execFileSync('node', [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  })
}

describe('nomark-engine CLI', () => {
  let tmpDir

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-test-'))
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}')
  })

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('--help prints usage', () => {
    const out = run(['--help'], tmpDir)
    assert.match(out, /npx nomark-engine/)
    assert.match(out, /--context-only/)
  })

  it('--context-only prints AI context block', () => {
    const out = run(['--context-only'], tmpDir)
    assert.match(out, /## nomark-engine/)
    assert.match(out, /createResolver/)
    assert.match(out, /nomark-ledger\.jsonl/)
  })

  it('creates ledger file with valid meta entry', () => {
    run([], tmpDir)
    const ledgerPath = path.join(tmpDir, 'nomark-ledger.jsonl')
    assert.ok(fs.existsSync(ledgerPath), 'ledger file should exist')

    const content = fs.readFileSync(ledgerPath, 'utf8').trim()
    const match = content.match(/^\[sig:meta\]\s+(.+)$/)
    assert.ok(match, 'should have [sig:meta] prefix')

    const data = JSON.parse(match[1])
    assert.equal(data.signals, 0)
    assert.ok(data.updated, 'should have updated date')
  })

  it('skips ledger when --no-ledger is passed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-nol-'))
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test"}')
    run(['--no-ledger'], dir)
    assert.ok(!fs.existsSync(path.join(dir, 'nomark-ledger.jsonl')))
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('appends context to CLAUDE.md when present', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-ctx-'))
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test"}')
    fs.mkdirSync(path.join(dir, '.claude'))
    fs.writeFileSync(path.join(dir, '.claude', 'CLAUDE.md'), '# Project\n')
    run([], dir)
    const content = fs.readFileSync(path.join(dir, '.claude', 'CLAUDE.md'), 'utf8')
    assert.match(content, /nomark-engine/)
    assert.match(content, /createResolver/)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('does not duplicate context on second run', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-dup-'))
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test"}')
    fs.mkdirSync(path.join(dir, '.claude'))
    fs.writeFileSync(path.join(dir, '.claude', 'CLAUDE.md'), '# Project\n')
    run([], dir)
    run([], dir)
    const content = fs.readFileSync(path.join(dir, '.claude', 'CLAUDE.md'), 'utf8')
    const matches = content.match(/## nomark-engine/g)
    assert.equal(matches.length, 1, 'should only have one context block')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
