import type { Conversation, Message, PlatformParser } from './types.js'

/**
 * ChatGPT export format (from Settings > Data controls > Export data).
 * The export zip contains conversations.json with this structure.
 */
type ChatGPTExport = ChatGPTConversation[]

type ChatGPTConversation = {
  id?: string
  title?: string
  create_time?: number
  update_time?: number
  mapping?: Record<string, ChatGPTNode>
}

type ChatGPTNode = {
  id?: string
  message?: {
    id?: string
    author?: { role?: string }
    content?: { parts?: (string | Record<string, unknown>)[] }
    create_time?: number
  }
  parent?: string
  children?: string[]
}

function extractMessages(mapping: Record<string, ChatGPTNode>): Message[] {
  // Build parent-child chain to get messages in order
  const nodes = Object.values(mapping)
  const childToParent = new Map<string, string>()
  const parentToChildren = new Map<string, string[]>()

  for (const node of nodes) {
    if (node.id && node.parent) {
      childToParent.set(node.id, node.parent)
    }
    if (node.id && node.children) {
      parentToChildren.set(node.id, node.children)
    }
  }

  // Find root (node with no parent or parent not in mapping)
  let rootId: string | undefined
  for (const node of nodes) {
    if (node.id && (!node.parent || !mapping[node.parent])) {
      rootId = node.id
      break
    }
  }

  if (!rootId) return []

  // Walk the tree depth-first following first child
  const messages: Message[] = []
  const visited = new Set<string>()
  const queue = [rootId]

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)

    const node = mapping[nodeId]
    if (node?.message?.content?.parts) {
      const role = node.message.author?.role
      if (role === 'user' || role === 'assistant') {
        const content = node.message.content.parts
          .filter((p): p is string => typeof p === 'string')
          .join('\n')
          .trim()

        if (content) {
          messages.push({
            role: role as 'user' | 'assistant',
            content,
            timestamp: node.message.create_time
              ? new Date(node.message.create_time * 1000).toISOString()
              : undefined,
          })
        }
      }
    }

    const children = parentToChildren.get(nodeId) ?? []
    queue.push(...children)
  }

  return messages
}

function parseConversation(conv: ChatGPTConversation): Conversation | null {
  if (!conv.mapping) return null

  const messages = extractMessages(conv.mapping)
  if (messages.length === 0) return null

  return {
    id: conv.id ?? `chatgpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: conv.title ?? undefined,
    messages,
    createdAt: conv.create_time ? new Date(conv.create_time * 1000).toISOString() : undefined,
    updatedAt: conv.update_time ? new Date(conv.update_time * 1000).toISOString() : undefined,
    platform: 'chatgpt',
  }
}

export function parseChatGPTExport(data: string | unknown[]): Conversation[] {
  let parsed: ChatGPTExport
  if (typeof data === 'string') {
    parsed = JSON.parse(data) as ChatGPTExport
  } else {
    parsed = data as ChatGPTExport
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .map(parseConversation)
    .filter((c): c is Conversation => c !== null)
}

export const chatgptParser: PlatformParser = {
  platform: 'chatgpt',
  parse: (data) => parseChatGPTExport(typeof data === 'string' ? data : JSON.stringify(data)),
}
