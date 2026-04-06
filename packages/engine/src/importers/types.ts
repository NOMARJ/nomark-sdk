import type { LedgerEntry } from '../schema.js'

// --- Normalized conversation model ---

export type MessageRole = 'user' | 'assistant' | 'system'

export type Message = {
  role: MessageRole
  content: string
  timestamp?: string
}

export type Conversation = {
  id: string
  title?: string
  messages: Message[]
  createdAt?: string
  updatedAt?: string
  platform: Platform
}

export type Platform = 'chatgpt' | 'claude' | 'gemini' | 'slack' | 'custom'

// --- Classification (Stage 1) ---

export type ItemClassification = 'SIGNAL' | 'CONTEXT' | 'DEAD' | 'GUARD'

export type ClassifiedItem = {
  conversation: Conversation
  classification: ItemClassification
  reason: string
}

// --- Extracted signals ---

export type ExtractedSignal = {
  type: 'pref' | 'map' | 'asn'
  data: Record<string, unknown>
  source: {
    conversationId: string
    messageIndex: number
    platform: Platform
  }
  occurrences: number
  confidence: number
}

// --- Confidence bands ---

export type ConfidenceBand = 'high' | 'medium' | 'low'

export function getConfidenceBand(occurrences: number): ConfidenceBand {
  if (occurrences >= 10) return 'high'
  if (occurrences >= 5) return 'medium'
  return 'low'
}

export function getConfidenceWeight(band: ConfidenceBand): number {
  switch (band) {
    case 'high': return 1.0
    case 'medium': return 0.8
    case 'low': return 0.6
  }
}

// --- Migration report ---

export type MigrationReport = {
  platform: Platform
  conversationsAnalyzed: number
  signalsExtracted: number
  signalsPromoted: number
  byConfidence: {
    high: number
    medium: number
    low: number
  }
  signals: ExtractedSignal[]
  ledgerEntries: LedgerEntry[]
  dryRun: boolean
}

// --- Model adapter ---

export type ModelResponse = {
  content: string
}

export type ModelAdapter = {
  complete(prompt: string): Promise<ModelResponse>
}

// --- Platform parser interface ---

export type PlatformParser = {
  platform: Platform
  parse(data: string | Record<string, unknown>): Conversation[]
}
