import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

let tmpDir: string
let originalHome: string | undefined
let originalEnv: string | undefined
let fixturePath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomark-test-'))
  originalHome = process.env['HOME']
  originalEnv = process.env['NOMARK_TOKEN']
  process.env['HOME'] = tmpDir
  delete process.env['NOMARK_TOKEN']

  fixturePath = path.join(tmpDir, 'conversations.json')
  const fixtureData = fs.readFileSync(
    path.join(__dirname, '..', 'fixtures', 'tiny-chatgpt.json'),
    'utf8',
  )
  fs.writeFileSync(fixturePath, fixtureData)
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

describe('importCommand', () => {
  it('exits 1 when not authenticated', async () => {
    const { importCommand } = await import('../../src/cli/import.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      importCommand({ platform: 'chatgpt', file: fixturePath }),
    ).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith('Not authenticated. Run `nomark login` first.')
  })

  it('exits 1 for unsupported platform', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    const { importCommand } = await import('../../src/cli/import.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      importCommand({ platform: 'twitter', file: fixturePath }),
    ).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(
      'Unsupported platform: twitter. Supported: chatgpt, claude, gemini',
    )
  })

  it('exits 1 when file not found', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    const { importCommand } = await import('../../src/cli/import.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const missingPath = path.join(tmpDir, 'nope.json')
    await expect(
      importCommand({ platform: 'chatgpt', file: missingPath }),
    ).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(`File not found: ${missingPath}`)
  })

  it('exits 1 when file is invalid JSON', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    const badJsonPath = path.join(tmpDir, 'bad.json')
    fs.writeFileSync(badJsonPath, 'not json {{{')

    const { importCommand } = await import('../../src/cli/import.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      importCommand({ platform: 'chatgpt', file: badJsonPath }),
    ).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(`Failed to parse file as JSON: ${badJsonPath}`)
  })

  it('exits 1 on 401 response', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }))

    const { importCommand } = await import('../../src/cli/import.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      importCommand({ platform: 'chatgpt', file: fixturePath }),
    ).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(
      'Not authenticated. Run `nomark login` to refresh your API key.',
    )
  })

  it('exits 1 on 500 response', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }))

    const { importCommand } = await import('../../src/cli/import.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      importCommand({ platform: 'chatgpt', file: fixturePath }),
    ).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith('Import failed (HTTP 500). Try again or contact support.')
  })

  it('exits 1 on network error', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { importCommand } = await import('../../src/cli/import.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      importCommand({ platform: 'chatgpt', file: fixturePath }),
    ).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith('Network error. Check your connection and try again.')
  })

  it('prints import summary on success', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    const mockResult = {
      platform: 'chatgpt',
      conversationsAnalyzed: 42,
      signalsExtracted: 15,
      signalsPromoted: 10,
      byConfidence: { high: 5, medium: 6, low: 4 },
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResult),
    }))

    const { importCommand } = await import('../../src/cli/import.js')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await importCommand({ platform: 'chatgpt', file: fixturePath })

    expect(logSpy).toHaveBeenCalledWith('  Analyzed 42 conversations from chatgpt.')
    expect(logSpy).toHaveBeenCalledWith(
      '  Extracted 15 signals (5 high, 6 medium, 4 low confidence).',
    )
    expect(logSpy).toHaveBeenCalledWith('  Promoted 10 to your NOMARK profile.')
  })

  it('supports claude platform', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    const mockResult = {
      platform: 'claude',
      conversationsAnalyzed: 5,
      signalsExtracted: 3,
      signalsPromoted: 2,
      byConfidence: { high: 1, medium: 1, low: 1 },
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResult),
    }))

    const { importCommand } = await import('../../src/cli/import.js')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await importCommand({ platform: 'claude', file: fixturePath })

    const fetchMock = vi.mocked(fetch)
    const callArg = fetchMock.mock.calls[0]
    if (!callArg) throw new Error('fetch not called')
    const [, init] = callArg
    const body = JSON.parse((init as RequestInit).body as string) as { platform: string }
    expect(body.platform).toBe('claude')
  })

  it('supports gemini platform', async () => {
    process.env['NOMARK_TOKEN'] = 'nomark_sk_test1234'

    const mockResult = {
      platform: 'gemini',
      conversationsAnalyzed: 3,
      signalsExtracted: 2,
      signalsPromoted: 1,
      byConfidence: { high: 1, medium: 0, low: 1 },
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResult),
    }))

    const { importCommand } = await import('../../src/cli/import.js')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await importCommand({ platform: 'gemini', file: fixturePath })

    const fetchMock = vi.mocked(fetch)
    const callArg = fetchMock.mock.calls[0]
    if (!callArg) throw new Error('fetch not called')
    const [, init] = callArg
    const body = JSON.parse((init as RequestInit).body as string) as { platform: string }
    expect(body.platform).toBe('gemini')
  })
})
