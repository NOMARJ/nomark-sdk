import type { Conversation, Message, PlatformParser } from './types.js'

/**
 * Claude export format (from Account > Export Data).
 * The export contains conversations in JSON format.
 */
type ClaudeExport = ClaudeConversation[]

type ClaudeConversation = {
  uuid?: string
  name?: string
  created_at?: string
  updated_at?: string
  chat_messages?: ClaudeMessage[]
}

type ClaudeMessage = {
  uuid?: string
  sender?: string // 'human' | 'assistant'
  text?: string
  content?: Array<{ type?: string; text?: string }>
  created_at?: string
}

function extractContent(msg: ClaudeMessage): string {
  // Try text field first (older exports)
  if (msg.text) return msg.text.trim()

  // Then content array (newer exports)
  if (msg.content) {
    return msg.content
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text!)
      .join('\n')
      .trim()
  }

  return ''
}

function mapRole(sender: string | undefined): 'user' | 'assistant' | null {
  if (sender === 'human') return 'user'
  if (sender === 'assistant') return 'assistant'
  return null
}

function parseConversation(conv: ClaudeConversation): Conversation | null {
  if (!conv.chat_messages || conv.chat_messages.length === 0) return null

  const messages: Message[] = []
  for (const msg of conv.chat_messages) {
    const role = mapRole(msg.sender)
    if (!role) continue

    const content = extractContent(msg)
    if (!content) continue

    messages.push({
      role,
      content,
      timestamp: msg.created_at ?? undefined,
    })
  }

  if (messages.length === 0) return null

  return {
    id: conv.uuid ?? `claude-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: conv.name ?? undefined,
    messages,
    createdAt: conv.created_at ?? undefined,
    updatedAt: conv.updated_at ?? undefined,
    platform: 'claude',
  }
}

export function parseClaudeExport(data: string | unknown[]): Conversation[] {
  let parsed: ClaudeExport
  if (typeof data === 'string') {
    parsed = JSON.parse(data) as ClaudeExport
  } else {
    parsed = data as ClaudeExport
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .map(parseConversation)
    .filter((c): c is Conversation => c !== null)
}

export const claudeParser: PlatformParser = {
  platform: 'claude',
  parse: (data) => parseClaudeExport(typeof data === 'string' ? data : JSON.stringify(data)),
}
