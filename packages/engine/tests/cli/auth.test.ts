import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { loadApiKey, saveApiKey, clearApiKey } from '../../src/cli/auth.js'

let tmpDir: string
let originalHome: string | undefined
let originalToken: string | undefined

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-auth-test-'))
  originalHome = process.env['HOME']
  originalToken = process.env['NOMARK_TOKEN']
  process.env['HOME'] = tmpDir
  delete process.env['NOMARK_TOKEN']
})

afterEach(() => {
  process.env['HOME'] = originalHome
  if (originalToken !== undefined) {
    process.env['NOMARK_TOKEN'] = originalToken
  } else {
    delete process.env['NOMARK_TOKEN']
  }
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('loadApiKey', () => {
  it('returns undefined when no config and no env var', () => {
    expect(loadApiKey()).toBeUndefined()
  })

  it('returns NOMARK_TOKEN env var when set', () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_envtest'
    expect(loadApiKey()).toBe('nomark_sk_envtest')
  })

  it('returns api_key from config file when present', () => {
    const configDir = path.join(tmpDir, '.nomark')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ api_key: 'nomark_sk_fromfile' })
    )
    expect(loadApiKey()).toBe('nomark_sk_fromfile')
  })

  it('returns undefined when config exists but has no api_key field', () => {
    const configDir = path.join(tmpDir, '.nomark')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ model: 'claude', apiKey: 'some-local-key' })
    )
    expect(loadApiKey()).toBeUndefined()
  })

  it('prefers NOMARK_TOKEN over config file', () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_env'
    const configDir = path.join(tmpDir, '.nomark')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ api_key: 'nomark_sk_file' })
    )
    expect(loadApiKey()).toBe('nomark_sk_env')
  })

  it('returns undefined when config file is malformed JSON', () => {
    const configDir = path.join(tmpDir, '.nomark')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, 'config.json'), '{invalid json}')
    expect(loadApiKey()).toBeUndefined()
  })
})

describe('saveApiKey', () => {
  it('creates config directory and file if they do not exist', () => {
    saveApiKey('nomark_sk_new')
    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    expect(fs.existsSync(configPath)).toBe(true)
  })

  it('writes api_key to config file', () => {
    saveApiKey('nomark_sk_abc123')
    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
    expect(data['api_key']).toBe('nomark_sk_abc123')
  })

  it('sets file permissions to 0600', () => {
    saveApiKey('nomark_sk_perms')
    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    const stat = fs.statSync(configPath)
    // 0o600 = 384 decimal; mask with 0o777 to get permission bits only
    expect(stat.mode & 0o777).toBe(0o600)
  })

  it('merges with existing config, preserving other keys', () => {
    const configDir = path.join(tmpDir, '.nomark')
    fs.mkdirSync(configDir, { recursive: true })
    const configPath = path.join(configDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ model: 'claude', apiKey: 'local-key' }))
    saveApiKey('nomark_sk_merged')
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
    expect(data['api_key']).toBe('nomark_sk_merged')
    expect(data['model']).toBe('claude')
    expect(data['apiKey']).toBe('local-key')
  })

  it('overwrites existing api_key', () => {
    saveApiKey('nomark_sk_first')
    saveApiKey('nomark_sk_second')
    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
    expect(data['api_key']).toBe('nomark_sk_second')
  })

  it('does not log the key to stdout or stderr', () => {
    const origLog = console.log
    const origErr = console.error
    const logged: string[] = []
    console.log = (...args: unknown[]) => logged.push(String(args))
    console.error = (...args: unknown[]) => logged.push(String(args))
    saveApiKey('nomark_sk_secret')
    console.log = origLog
    console.error = origErr
    for (const msg of logged) {
      expect(msg).not.toContain('nomark_sk_secret')
    }
  })
})

describe('clearApiKey', () => {
  it('does nothing when config file does not exist', () => {
    expect(() => clearApiKey()).not.toThrow()
  })

  it('removes api_key from config file', () => {
    saveApiKey('nomark_sk_todelete')
    clearApiKey()
    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
    expect(data['api_key']).toBeUndefined()
  })

  it('preserves other keys when clearing api_key', () => {
    const configDir = path.join(tmpDir, '.nomark')
    fs.mkdirSync(configDir, { recursive: true })
    const configPath = path.join(configDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ model: 'gpt', api_key: 'nomark_sk_old' }))
    clearApiKey()
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
    expect(data['model']).toBe('gpt')
    expect(data['api_key']).toBeUndefined()
  })
})
