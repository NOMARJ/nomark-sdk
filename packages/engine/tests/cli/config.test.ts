import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { loadConfig, saveConfig } from '../../src/cli/config.js'

let tmpDir: string
let originalHome: string | undefined
let originalNomarkToken: string | undefined

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-cfg-test-'))
  originalHome = process.env['HOME']
  originalNomarkToken = process.env['NOMARK_TOKEN']
  process.env['HOME'] = tmpDir
  delete process.env['NOMARK_TOKEN']
})

afterEach(() => {
  process.env['HOME'] = originalHome
  if (originalNomarkToken !== undefined) {
    process.env['NOMARK_TOKEN'] = originalNomarkToken
  } else {
    delete process.env['NOMARK_TOKEN']
  }
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('saveConfig / loadConfig — token field', () => {
  it('saves token as api_key in JSON', () => {
    saveConfig({ token: 'nomark_sk_abc123' })
    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
    expect(raw['api_key']).toBe('nomark_sk_abc123')
    expect(raw['token']).toBeUndefined()
  })

  it('reads api_key from JSON into token field', () => {
    saveConfig({ token: 'nomark_sk_xyz987' })
    const config = loadConfig()
    expect(config.token).toBe('nomark_sk_xyz987')
  })

  it('chmod 0600 on config file after save', () => {
    saveConfig({ token: 'nomark_sk_test' })
    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    const stat = fs.statSync(configPath)
    const mode = stat.mode & 0o777
    expect(mode).toBe(0o600)
  })

  it('NOMARK_TOKEN env var overrides file token', () => {
    saveConfig({ token: 'nomark_sk_from_file' })
    process.env['NOMARK_TOKEN'] = 'nomark_sk_from_env'
    const config = loadConfig()
    expect(config.token).toBe('nomark_sk_from_env')
  })

  it('merges token with existing config fields', () => {
    saveConfig({ model: 'claude' })
    saveConfig({ token: 'nomark_sk_new' })
    const config = loadConfig()
    expect(config.model).toBe('claude')
    expect(config.token).toBe('nomark_sk_new')
  })

  it('returns empty config when no file exists', () => {
    const config = loadConfig()
    expect(config.token).toBeUndefined()
    expect(config.model).toBeUndefined()
  })

  it('does not write token key when token is undefined', () => {
    saveConfig({ model: 'gpt-4' })
    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
    expect(raw['api_key']).toBeUndefined()
    expect(raw['model']).toBe('gpt-4')
  })
})
