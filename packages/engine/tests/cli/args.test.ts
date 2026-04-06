import { describe, it, expect } from 'vitest'
import { parseArgs, requireFlag } from '../../src/cli/args.js'

describe('parseArgs', () => {
  it('parses command', () => {
    const result = parseArgs(['node', 'nomark', 'config'])
    expect(result.command).toBe('config')
  })

  it('parses --key value flags', () => {
    const result = parseArgs(['node', 'nomark', 'config', '--model', 'claude'])
    expect(result.flags['model']).toBe('claude')
  })

  it('parses --key=value flags', () => {
    const result = parseArgs(['node', 'nomark', 'config', '--model=gpt'])
    expect(result.flags['model']).toBe('gpt')
  })

  it('parses boolean flags', () => {
    const result = parseArgs(['node', 'nomark', 'import', '--dry-run'])
    expect(result.flags['dry-run']).toBe(true)
  })

  it('parses multiple flags', () => {
    const result = parseArgs(['node', 'nomark', 'import', '--platform', 'chatgpt', '--file', 'export.json'])
    expect(result.flags['platform']).toBe('chatgpt')
    expect(result.flags['file']).toBe('export.json')
  })

  it('returns empty command for no args', () => {
    const result = parseArgs(['node', 'nomark'])
    expect(result.command).toBe('')
  })
})

describe('requireFlag', () => {
  it('returns value when present', () => {
    expect(requireFlag({ platform: 'chatgpt' }, 'platform')).toBe('chatgpt')
  })

  it('throws when missing', () => {
    expect(() => requireFlag({}, 'platform')).toThrow('Missing required flag: --platform')
  })

  it('throws when boolean', () => {
    expect(() => requireFlag({ platform: true }, 'platform')).toThrow('Missing required flag: --platform')
  })
})
