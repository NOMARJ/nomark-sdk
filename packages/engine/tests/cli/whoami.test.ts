import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { saveConfig } from '../../src/cli/config.js'

let tmpDir: string
let originalHome: string | undefined
let originalNomarkToken: string | undefined

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-whoami-test-'))
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

describe('whoamiCommand', () => {
  it('exits 1 with message when not authenticated', async () => {
    const { whoamiCommand } = await import('../../src/cli/whoami.js')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(whoamiCommand()).rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'))
  })

  it('shows authenticated status on valid token', async () => {
    saveConfig({ token: 'nomark_sk_mytoken' })
    const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { whoamiCommand } = await import('../../src/cli/whoami.js')
    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await whoamiCommand()
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Authenticated'))
  })

  it('exits 1 on 401 response', async () => {
    saveConfig({ token: 'nomark_sk_badtoken' })
    const mockFetch = vi.fn().mockResolvedValue({ status: 401, ok: false } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { whoamiCommand } = await import('../../src/cli/whoami.js')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })

    await expect(whoamiCommand()).rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('exits 1 on network error', async () => {
    saveConfig({ token: 'nomark_sk_test' })
    const mockFetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND'))
    vi.stubGlobal('fetch', mockFetch)

    const { whoamiCommand } = await import('../../src/cli/whoami.js')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })

    await expect(whoamiCommand()).rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('reads token from NOMARK_TOKEN env', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_envtoken'
    const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { whoamiCommand } = await import('../../src/cli/whoami.js')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await whoamiCommand()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer nomark_sk_envtoken' }),
      })
    )
  })
})
