import type {
  Conversation, ClassifiedItem, ExtractedSignal, MigrationReport,
  Platform,
} from './types.js'
import { getConfidenceBand, getConfidenceWeight } from './types.js'
import type { LedgerEntry, SigPref, SigMap } from '../schema.js'
import { isStylisticPref } from '../schema.js'
import { extractSignals } from './extractor.js'
import { parseLedger } from '../ledger.js'

// --- Stage 1: Classification ---

function classifyConversations(conversations: Conversation[]): ClassifiedItem[] {
  return conversations.map(conv => {
    const hasUserMessages = conv.messages.some(m => m.role === 'user')
    if (!hasUserMessages) {
      return { conversation: conv, classification: 'DEAD' as const, reason: 'no user messages' }
    }

    const messageCount = conv.messages.length
    if (messageCount < 2) {
      return { conversation: conv, classification: 'DEAD' as const, reason: 'single message, no interaction' }
    }

    // Check for corrections (signals)
    const hasCorrections = conv.messages.some(m =>
      m.role === 'user' && /\b(no[,.]?\s+(not|wrong|different)|actually|too (long|short|formal)|make it|be more|don'?t|stop|can you (be|use|avoid)|skip|shorter|longer)\b/i.test(m.content)
    )

    if (hasCorrections) {
      return { conversation: conv, classification: 'SIGNAL' as const, reason: 'contains corrections or preferences' }
    }

    // Check for guard-worthy content (factual corrections)
    const hasFactualCorrections = conv.messages.some(m =>
      m.role === 'user' && /\b(that'?s (wrong|incorrect|not (right|true))|the (correct|right|actual) (answer|value|number))\b/i.test(m.content)
    )

    if (hasFactualCorrections) {
      return { conversation: conv, classification: 'GUARD' as const, reason: 'contains factual correction' }
    }

    return { conversation: conv, classification: 'CONTEXT' as const, reason: 'active conversation' }
  })
}

// --- Stage 2: Deduplication ---

function deduplicateAgainstLedger(
  signals: ExtractedSignal[],
  existingLedger: LedgerEntry[],
): ExtractedSignal[] {
  const existingPrefs = new Set<string>()
  const existingMaps = new Set<string>()

  for (const entry of existingLedger) {
    if (entry.type === 'pref' && isStylisticPref(entry.data)) {
      existingPrefs.add(`${entry.data.dim}::${entry.data.target}::${entry.data.scope}`)
    }
    if (entry.type === 'map') {
      existingMaps.add(entry.data.trigger.toLowerCase())
    }
  }

  return signals.filter(signal => {
    if (signal.type === 'pref') {
      const data = signal.data as SigPref
      const key = `${data.dim}::${data.target}::${data.scope}`
      return !existingPrefs.has(key)
    }
    if (signal.type === 'map') {
      const data = signal.data as SigMap
      return !existingMaps.has(data.trigger.toLowerCase())
    }
    return true
  })
}

// --- Stage 3: Value test ---

function applyValueTest(signals: ExtractedSignal[]): ExtractedSignal[] {
  return signals.filter(signal => {
    // Repeated: 3+ occurrences
    if (signal.occurrences >= 3) return true

    // Cross-context: appears in 2+ contexts (checked by source diversity)
    // For single-platform import, this won't trigger — that's correct.
    // Cross-context value comes from importing multiple platforms.

    return false
  })
}

// --- Stage 4: Apply confidence weights ---

function applyConfidenceWeights(signals: ExtractedSignal[]): ExtractedSignal[] {
  return signals.map(signal => {
    const band = getConfidenceBand(signal.occurrences)
    const weight = getConfidenceWeight(band)

    const data = { ...signal.data } as Record<string, unknown>
    if (signal.type === 'pref' && typeof data['w'] === 'number') {
      data['w'] = Math.round(((data['w'] as number) * weight) * 1000) / 1000
    }
    if (signal.type === 'map' && typeof data['conf'] === 'number') {
      data['conf'] = Math.round(((data['conf'] as number) * weight) * 1000) / 1000
    }

    // Low confidence signals are staged
    if (band === 'low') {
      data['staged'] = true
    }

    return {
      ...signal,
      data,
      confidence: weight,
    }
  })
}

// --- Stage 5: Convert to ledger entries ---

function toLedgerEntries(signals: ExtractedSignal[]): LedgerEntry[] {
  return signals.map(signal => ({
    type: signal.type,
    data: signal.data,
  })) as LedgerEntry[]
}

// --- Pipeline orchestrator ---

export type MigrationOptions = {
  existingLedger?: string | LedgerEntry[]
  dryRun?: boolean
  maxConversations?: number
}

/**
 * Run the 5-stage migration pipeline.
 *
 * 1. Classification — categorize conversations as SIGNAL/CONTEXT/DEAD/GUARD
 * 2. Deduplication — remove signals already in existing ledger
 * 3. Signal extraction — extract preferences, meaning maps from SIGNAL conversations
 * 4. Value test + confidence — apply promotion criteria and weight by confidence band
 * 5. Dry run / output — return report (always audit-first)
 */
export function runMigration(
  conversations: Conversation[],
  options: MigrationOptions = {},
): MigrationReport {
  const { dryRun = true, maxConversations } = options
  const platform: Platform = conversations[0]?.platform ?? 'custom'

  // Apply conversation limit
  const limited = maxConversations
    ? conversations.slice(0, maxConversations)
    : conversations

  // Stage 1: Classify
  const classified = classifyConversations(limited)
  const signalConvos = classified
    .filter(c => c.classification === 'SIGNAL')
    .map(c => c.conversation)

  // Stage 3: Extract signals from SIGNAL conversations
  const rawSignals = extractSignals(signalConvos)

  // Stage 2: Deduplicate against existing ledger
  let existingEntries: LedgerEntry[] = []
  if (options.existingLedger) {
    existingEntries = typeof options.existingLedger === 'string'
      ? parseLedger(options.existingLedger)
      : options.existingLedger
  }
  const deduped = deduplicateAgainstLedger(rawSignals, existingEntries)

  // Stage 4: Value test + confidence weights
  const promoted = applyValueTest(deduped)
  const weighted = applyConfidenceWeights(promoted)

  // Stage 5: Build report
  const ledgerEntries = dryRun ? [] : toLedgerEntries(weighted)

  const byConfidence = { high: 0, medium: 0, low: 0 }
  for (const signal of weighted) {
    const band = getConfidenceBand(signal.occurrences)
    byConfidence[band]++
  }

  return {
    platform,
    conversationsAnalyzed: limited.length,
    signalsExtracted: rawSignals.length,
    signalsPromoted: weighted.length,
    byConfidence,
    signals: weighted,
    ledgerEntries,
    dryRun,
  }
}
