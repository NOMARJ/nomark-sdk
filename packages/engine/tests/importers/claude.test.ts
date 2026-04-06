import { describe, it, expect } from 'vitest'
import { parseClaudeExport } from '../../src/importers/claude.js'

const SAMPLE_EXPORT = [
  {
    uuid: 'conv-001',
    name: 'Code review help',
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:30:00Z',
    chat_messages: [
      {
        uuid: 'msg-001',
        sender: 'human',
        text: 'Review this function for me',
        created_at: '2026-04-01T10:00:00Z',
      },
      {
        uuid: 'msg-002',
        sender: 'assistant',
        text: 'Here are my observations about the function...',
        created_at: '2026-04-01T10:01:00Z',
      },
      {
        uuid: 'msg-003',
        sender: 'human',
        text: 'Be more direct, skip the preamble',
        created_at: '2026-04-01T10:02:00Z',
      },
    ],
  },
  {
    uuid: 'conv-002',
    name: 'Newer format',
    chat_messages: [
      {
        uuid: 'msg-010',
        sender: 'human',
        content: [{ type: 'text', text: 'Help me write a test' }],
        created_at: '2026-04-02T09:00:00Z',
      },
      {
        uuid: 'msg-011',
        sender: 'assistant',
        content: [{ type: 'text', text: 'Here is a test for your function...' }],
        created_at: '2026-04-02T09:01:00Z',
      },
    ],
  },
  {
    uuid: 'conv-003',
    name: 'Empty',
    chat_messages: [],
  },
]

describe('parseClaudeExport', () => {
  it('parses conversations from array', () => {
    const convos = parseClaudeExport(SAMPLE_EXPORT)
    expect(convos).toHaveLength(2) // third is empty
    expect(convos[0]!.id).toBe('conv-001')
    expect(convos[0]!.platform).toBe('claude')
  })

  it('extracts messages with correct roles', () => {
    const convos = parseClaudeExport(SAMPLE_EXPORT)
    const msgs = convos[0]!.messages
    expect(msgs).toHaveLength(3)
    expect(msgs[0]!.role).toBe('user')
    expect(msgs[1]!.role).toBe('assistant')
    expect(msgs[2]!.content).toContain('direct')
  })

  it('handles text field (older format)', () => {
    const convos = parseClaudeExport(SAMPLE_EXPORT)
    expect(convos[0]!.messages[0]!.content).toBe('Review this function for me')
  })

  it('handles content array (newer format)', () => {
    const convos = parseClaudeExport(SAMPLE_EXPORT)
    expect(convos[1]!.messages[0]!.content).toBe('Help me write a test')
  })

  it('preserves timestamps', () => {
    const convos = parseClaudeExport(SAMPLE_EXPORT)
    expect(convos[0]!.createdAt).toBe('2026-04-01T10:00:00Z')
    expect(convos[0]!.messages[0]!.timestamp).toBe('2026-04-01T10:00:00Z')
  })

  it('parses from JSON string', () => {
    const convos = parseClaudeExport(JSON.stringify(SAMPLE_EXPORT))
    expect(convos).toHaveLength(2)
  })

  it('handles empty input', () => {
    expect(parseClaudeExport([])).toHaveLength(0)
    expect(parseClaudeExport('[]')).toHaveLength(0)
  })

  it('skips messages with unknown sender', () => {
    const data = [{
      uuid: 'conv-unknown',
      chat_messages: [
        { uuid: 'msg', sender: 'tool', text: 'tool output' },
      ],
    }]
    const convos = parseClaudeExport(data)
    expect(convos).toHaveLength(0)
  })
})
