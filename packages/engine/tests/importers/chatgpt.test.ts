import { describe, it, expect } from 'vitest'
import { parseChatGPTExport } from '../../src/importers/chatgpt.js'

const SAMPLE_EXPORT = [
  {
    id: 'conv-001',
    title: 'Help with TypeScript',
    create_time: 1712000000, // ~2024-04-02
    update_time: 1712003600,
    mapping: {
      'root': {
        id: 'root',
        message: null,
        children: ['msg-1'],
      },
      'msg-1': {
        id: 'msg-1',
        message: {
          id: 'msg-1',
          author: { role: 'user' },
          content: { parts: ['How do I use generics in TypeScript?'] },
          create_time: 1712000100,
        },
        parent: 'root',
        children: ['msg-2'],
      },
      'msg-2': {
        id: 'msg-2',
        message: {
          id: 'msg-2',
          author: { role: 'assistant' },
          content: { parts: ['Generics allow you to create reusable components...'] },
          create_time: 1712000200,
        },
        parent: 'msg-1',
        children: ['msg-3'],
      },
      'msg-3': {
        id: 'msg-3',
        message: {
          id: 'msg-3',
          author: { role: 'user' },
          content: { parts: ['Make it shorter, I already know the basics'] },
          create_time: 1712000300,
        },
        parent: 'msg-2',
        children: [],
      },
    },
  },
  {
    id: 'conv-002',
    title: 'Empty conversation',
    mapping: {},
  },
]

describe('parseChatGPTExport', () => {
  it('parses conversations from array', () => {
    const convos = parseChatGPTExport(SAMPLE_EXPORT)
    expect(convos).toHaveLength(1) // second one is empty
    expect(convos[0]!.id).toBe('conv-001')
    expect(convos[0]!.platform).toBe('chatgpt')
  })

  it('extracts messages in order', () => {
    const convos = parseChatGPTExport(SAMPLE_EXPORT)
    const msgs = convos[0]!.messages
    expect(msgs).toHaveLength(3)
    expect(msgs[0]!.role).toBe('user')
    expect(msgs[1]!.role).toBe('assistant')
    expect(msgs[2]!.role).toBe('user')
    expect(msgs[2]!.content).toContain('shorter')
  })

  it('converts timestamps', () => {
    const convos = parseChatGPTExport(SAMPLE_EXPORT)
    expect(convos[0]!.createdAt).toBeDefined()
    expect(convos[0]!.messages[0]!.timestamp).toBeDefined()
  })

  it('parses from JSON string', () => {
    const convos = parseChatGPTExport(JSON.stringify(SAMPLE_EXPORT))
    expect(convos).toHaveLength(1)
  })

  it('skips system messages', () => {
    const data = [{
      id: 'conv-sys',
      mapping: {
        'root': { id: 'root', children: ['sys'] },
        'sys': {
          id: 'sys',
          message: {
            id: 'sys',
            author: { role: 'system' },
            content: { parts: ['You are a helpful assistant'] },
          },
          parent: 'root',
          children: [],
        },
      },
    }]
    const convos = parseChatGPTExport(data)
    expect(convos).toHaveLength(0) // no user/assistant messages
  })

  it('handles empty input', () => {
    expect(parseChatGPTExport([])).toHaveLength(0)
    expect(parseChatGPTExport('[]')).toHaveLength(0)
  })

  it('filters out non-string parts', () => {
    const data = [{
      id: 'conv-mixed',
      mapping: {
        'root': { id: 'root', children: ['msg'] },
        'msg': {
          id: 'msg',
          message: {
            id: 'msg',
            author: { role: 'user' },
            content: { parts: ['text content', { type: 'image' }] },
          },
          parent: 'root',
          children: [],
        },
      },
    }]
    const convos = parseChatGPTExport(data)
    expect(convos[0]!.messages[0]!.content).toBe('text content')
  })
})
