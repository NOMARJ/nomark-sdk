import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

let tmpDir: string
let originalHome: string | undefined
let originalEnv: string | undefined

beforeEach(() => {
  vi.resetModules()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-test-'))
  originalHome = process.env['HOME']
  originalEnv = process.env['NOMARK_TOKEN']
  process.env['HOME'] = tmpDir
  delete process.env['NOMARK_TOKEN']
})

afterEach(() => {
  process.env['HOME'] = originalHome
  if (originalEnv !== undefined) {
    process.env['NOMARK_TOKEN'] = originalEnv
  } else {
    delete process.env['NOMARK_TOKEN']
  }
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('loginCommand', () => {
  it('saves api key from NOMARK_TOKEN env var', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_stest'

    const { loginCommand } = await import('../../src/cli/login.js')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await loginCommand()

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('stest'))
    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { api_key: string }
    expect(config.api_key).toBe('nomark_sk_stest')
  })

  it('exits 1 for invalid key format', async () => {
    process.env['NOMARK_TOKEN'] = 'not_a_valid_key'

    const { loginCommand } = await import('../../src/cli/login.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(loginCommand()).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(
      'Invalid API key format. Key must start with nomark_sk_',
    )
  })

  it('sets config file to mode 0600', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_sectest'

    const { loginCommand } = await import('../../src/cli/login.js')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await loginCommand()

    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    const stat = fs.statSync(configPath)
    expect(stat.mode & 0o777).toBe(0o600)
  })

  it('does not log the full key', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_secretvalue'

    const { loginCommand } = await import('../../src/cli/login.js')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await loginCommand()

    for (const call of logSpy.mock.calls) {
      const output = call.join(' ')
      expect(output).not.toContain('nomark_sk_secretvalue')
    }
  })
})
