import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { loadConfig } from '../../src/cli/config.js'

let tmpDir: string
let originalHome: string | undefined
let originalNomarkToken: string | undefined

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-login-test-'))
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
  vi.restoreAllMocks()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('loginCommand', () => {
  it('saves valid token from NOMARK_TOKEN env', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_validkey'
    const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { loginCommand } = await import('../../src/cli/login.js')
    await loginCommand()

    const config = loadConfig()
    expect(config.token).toBe('nomark_sk_validkey')

    const configPath = path.join(tmpDir, '.nomark', 'config.json')
    const stat = fs.statSync(configPath)
    expect(stat.mode & 0o777).toBe(0o600)
  })

  it('exits non-zero on 401', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_badkey'
    const mockFetch = vi.fn().mockResolvedValue({ status: 401, ok: false } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { loginCommand } = await import('../../src/cli/login.js')

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })
    await expect(loginCommand()).rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('exits non-zero on invalid key format', async () => {
    process.env['NOMARK_TOKEN'] = 'not_a_nomark_key'
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const { loginCommand } = await import('../../src/cli/login.js')

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })
    await expect(loginCommand()).rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('exits non-zero on network error', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_validformat'
    const mockFetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND'))
    vi.stubGlobal('fetch', mockFetch)

    const { loginCommand } = await import('../../src/cli/login.js')

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })
    await expect(loginCommand()).rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('posts to process-import with correct headers', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_abc'
    const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { loginCommand } = await import('../../src/cli/login.js')
    await loginCommand()

    expect(mockFetch).toHaveBeenCalledWith(
      'https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer nomark_sk_abc',
        }),
      })
    )
  })
})
