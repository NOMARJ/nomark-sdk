import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { saveConfig } from '../../src/cli/config.js'

let tmpDir: string
let originalHome: string | undefined
let originalNomarkToken: string | undefined

const MOCK_RESULT = {
  platform: 'chatgpt',
  conversationsAnalyzed: 3,
  signalsExtracted: 12,
  signalsPromoted: 8,
  byConfidence: { high: 4, medium: 5, low: 3 },
}

function writeTmpFile(content: string): string {
  const filePath = path.join(tmpDir, 'export.json')
  fs.writeFileSync(filePath, content)
  return filePath
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-import-test-'))
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

describe('importCommand', () => {
  it('posts to process-import with chatgpt platform', async () => {
    saveConfig({ token: 'nomark_sk_test' })
    const filePath = writeTmpFile('[{"id": "1"}]')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...MOCK_RESULT, platform: 'chatgpt' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { importCommand } = await import('../../src/cli/import.js')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await importCommand({ platform: 'chatgpt', file: filePath })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://cnwiskdzeygqxezmazoq.supabase.co/functions/v1/process-import',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer nomark_sk_test',
          'Content-Type': 'application/json',
        }),
      })
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>
    expect(body['platform']).toBe('chatgpt')
  })

  it('posts to process-import with claude platform', async () => {
    saveConfig({ token: 'nomark_sk_test' })
    const filePath = writeTmpFile('[{"uuid": "abc"}]')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...MOCK_RESULT, platform: 'claude' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { importCommand } = await import('../../src/cli/import.js')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await importCommand({ platform: 'claude', file: filePath })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>
    expect(body['platform']).toBe('claude')
  })

  it('posts to process-import with gemini platform', async () => {
    saveConfig({ token: 'nomark_sk_test' })
    const filePath = writeTmpFile('{"conversations": []}')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...MOCK_RESULT, platform: 'gemini' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { importCommand } = await import('../../src/cli/import.js')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await importCommand({ platform: 'gemini', file: filePath })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>
    expect(body['platform']).toBe('gemini')
  })

  it('exits 1 when file not found', async () => {
    saveConfig({ token: 'nomark_sk_test' })

    const { importCommand } = await import('../../src/cli/import.js')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })

    await expect(importCommand({ platform: 'chatgpt', file: '/nonexistent/path.json' }))
      .rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('exits 1 on invalid JSON in file', async () => {
    saveConfig({ token: 'nomark_sk_test' })
    const filePath = writeTmpFile('not valid json {{{')

    const { importCommand } = await import('../../src/cli/import.js')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })

    await expect(importCommand({ platform: 'chatgpt', file: filePath }))
      .rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('exits 1 on unsupported platform', async () => {
    saveConfig({ token: 'nomark_sk_test' })
    const filePath = writeTmpFile('[]')

    const { importCommand } = await import('../../src/cli/import.js')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })

    await expect(importCommand({ platform: 'unsupported', file: filePath }))
      .rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('exits 1 when not authenticated', async () => {
    const filePath = writeTmpFile('[]')

    const { importCommand } = await import('../../src/cli/import.js')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })

    await expect(importCommand({ platform: 'chatgpt', file: filePath }))
      .rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('exits 1 on HTTP 401 response', async () => {
    saveConfig({ token: 'nomark_sk_expired' })
    const filePath = writeTmpFile('[]')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as unknown as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { importCommand } = await import('../../src/cli/import.js')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })

    await expect(importCommand({ platform: 'chatgpt', file: filePath }))
      .rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('exits 1 on non-2xx response', async () => {
    saveConfig({ token: 'nomark_sk_test' })
    const filePath = writeTmpFile('[]')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as unknown as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { importCommand } = await import('../../src/cli/import.js')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })

    await expect(importCommand({ platform: 'chatgpt', file: filePath }))
      .rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('exits 1 on network error', async () => {
    saveConfig({ token: 'nomark_sk_test' })
    const filePath = writeTmpFile('[]')

    const mockFetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND'))
    vi.stubGlobal('fetch', mockFetch)

    const { importCommand } = await import('../../src/cli/import.js')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit') })

    await expect(importCommand({ platform: 'chatgpt', file: filePath }))
      .rejects.toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('prints ImportResult summary on success', async () => {
    saveConfig({ token: 'nomark_sk_test' })
    const filePath = writeTmpFile('[{"id": "1"}, {"id": "2"}, {"id": "3"}]')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_RESULT,
    } as unknown as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { importCommand } = await import('../../src/cli/import.js')
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => { logs.push(args.join(' ')) })

    await importCommand({ platform: 'chatgpt', file: filePath })

    const output = logs.join('\n')
    expect(output).toContain('Import complete')
    expect(output).toContain('chatgpt')
    expect(output).toContain('3')
    expect(output).toContain('12')
  })

  it('missing --platform flag throws', async () => {
    saveConfig({ token: 'nomark_sk_test' })
    const filePath = writeTmpFile('[]')

    const { importCommand } = await import('../../src/cli/import.js')

    await expect(importCommand({ file: filePath })).rejects.toThrow('Missing required flag: --platform')
  })

  it('missing --file flag throws', async () => {
    saveConfig({ token: 'nomark_sk_test' })

    const { importCommand } = await import('../../src/cli/import.js')

    await expect(importCommand({ platform: 'chatgpt' })).rejects.toThrow('Missing required flag: --file')
  })
})
