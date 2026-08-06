import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

let tmpDir: string
let originalHome: string | undefined
let originalEnv: string | undefined

beforeEach(() => {
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

describe('whoamiCommand', () => {
  it('exits 1 with message when no key configured', async () => {
    const { whoamiCommand } = await import('../../src/cli/whoami.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(whoamiCommand()).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith('Not authenticated. Run `nomark login`.')
  })

  it('exits 1 with message on 401 response', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
    }))

    const { whoamiCommand } = await import('../../src/cli/whoami.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(whoamiCommand()).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith('Not authenticated. Run `nomark login`.')
  })

  it('prints Authenticated on 200 response', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
    }))

    const { whoamiCommand } = await import('../../src/cli/whoami.js')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await whoamiCommand()
    expect(logSpy).toHaveBeenCalledWith('Authenticated')
  })

  it('exits 1 on network error', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { whoamiCommand } = await import('../../src/cli/whoami.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(whoamiCommand()).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith('Not authenticated. Run `nomark login`.')
  })
})
