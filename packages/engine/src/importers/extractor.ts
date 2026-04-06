import type { Conversation, ExtractedSignal, Platform } from './types.js'

// --- Correction detection heuristics ---

const CORRECTION_PATTERNS = [
  /\b(no[,.]?\s+(not that|wrong|different|I meant|the other))/i,
  /\b(actually|wait|hold on|scratch that|never\s?mind)/i,
  /\b(too (long|short|formal|informal|verbose|brief|wordy|terse))\b/i,
  /\b(make it (shorter|longer|simpler|more \w+|less \w+))\b/i,
  /\b(don'?t (use|add|include|say|write|mention))\b/i,
  /\b(stop (using|adding|including|saying|writing))\b/i,
  /\b(I (prefer|want|need|like) (it )?(\w+ )?(shorter|longer|simpler|more \w+|less \w+|direct|formal|informal))\b/i,
  /\b(can you (be more|be less|use|avoid|stop|skip))\b/i,
  /\b(instead of .+[,;] (use|try|do|say|write))\b/i,
  /\b(be more (direct|formal|informal|casual|concise|brief|detailed|specific))\b/i,
  /\b(too (much|many|few|little) (\w+))\b/i,
]

const STYLE_DIMENSIONS: Record<string, { patterns: RegExp[]; target: string }[]> = {
  tone: [
    { patterns: [/\b(more direct|be direct|directness|get to the point|skip.*preamble)\b/i], target: 'direct' },
    { patterns: [/\b(more formal|formal tone|professional tone|formal register)\b/i], target: 'formal' },
    { patterns: [/\b(more casual|casual tone|informal|relaxed tone)\b/i], target: 'casual' },
    { patterns: [/\b(more friendly|friendlier|warm(er)?)\b/i], target: 'friendly' },
  ],
  length: [
    { patterns: [/\b(shorter|more concise|brief(er)?|less (verbose|wordy)|cut it down|too long)\b/i], target: 'short' },
    { patterns: [/\b(longer|more detail|elaborate|expand|in depth|too short)\b/i], target: 'long' },
  ],
  format: [
    { patterns: [/\b(use bullets|bullet points|bulleted|bullet list)\b/i], target: 'bullets' },
    { patterns: [/\b(use (numbered|ordered) list)\b/i], target: 'numbered' },
    { patterns: [/\b(use code blocks|show.*code|code example)\b/i], target: 'code' },
    { patterns: [/\b(paragraph form|no bullets|prose|narrative)\b/i], target: 'prose' },
  ],
}

// --- Meaning map detection ---

type MeaningMapCandidate = {
  trigger: string
  patternType: 'rewrite_request' | 'scope_change' | 'quality_complaint' | 'format_request' | 'style_override' | 'abort'
  intent: string[]
}

const MEANING_MAP_PATTERNS: { test: RegExp; extract: (match: RegExpMatchArray, full: string) => MeaningMapCandidate | null }[] = [
  {
    test: /\bmake it (shorter|longer|simpler|more \w+|less \w+)\b/i,
    extract: (match, _full) => {
      const directive = match[1]!.toLowerCase()
      const intents: string[] = []
      if (directive.includes('short')) intents.push('reduce_length_40pct', 'remove_examples', 'keep_structure')
      else if (directive.includes('long')) intents.push('add_detail', 'add_examples', 'expand_sections')
      else if (directive.includes('simpl')) intents.push('reduce_complexity', 'shorter_sentences', 'remove_jargon')
      else intents.push(directive.replace(/\s+/g, '_'))
      return {
        trigger: `make it ${directive}`,
        patternType: 'rewrite_request',
        intent: intents,
      }
    },
  },
  {
    test: /\b(skip|remove|don'?t (include|add|use)) (the )?(preamble|introduction|intro|summary|examples?|headers?)\b/i,
    extract: (match) => {
      const target = (match[4] ?? match[3] ?? '').toLowerCase()
      return {
        trigger: `skip ${target}`,
        patternType: 'format_request',
        intent: [`remove_${target}`, 'reduce_length'],
      }
    },
  },
]

// --- Extraction engine ---

type PrefAccumulator = Map<string, { dim: string; target: string; count: number; sources: Set<string>; messageIndices: number[] }>
type MapAccumulator = Map<string, { candidate: MeaningMapCandidate; count: number; sources: Set<string> }>

function detectCorrections(content: string): boolean {
  return CORRECTION_PATTERNS.some(p => p.test(content))
}

function extractStylePreferences(content: string, convId: string, msgIdx: number, prefs: PrefAccumulator): void {
  for (const [dim, targets] of Object.entries(STYLE_DIMENSIONS)) {
    for (const { patterns, target } of targets) {
      if (patterns.some(p => p.test(content))) {
        const key = `${dim}::${target}`
        const existing = prefs.get(key)
        if (existing) {
          existing.count++
          existing.sources.add(convId)
          existing.messageIndices.push(msgIdx)
        } else {
          prefs.set(key, {
            dim, target, count: 1,
            sources: new Set([convId]),
            messageIndices: [msgIdx],
          })
        }
      }
    }
  }
}

function extractMeaningMaps(content: string, convId: string, maps: MapAccumulator): void {
  for (const { test, extract } of MEANING_MAP_PATTERNS) {
    const match = content.match(test)
    if (match) {
      const candidate = extract(match, content)
      if (!candidate) continue

      const key = candidate.trigger.toLowerCase()
      const existing = maps.get(key)
      if (existing) {
        existing.count++
        existing.sources.add(convId)
      } else {
        maps.set(key, {
          candidate,
          count: 1,
          sources: new Set([convId]),
        })
      }
    }
  }
}

/**
 * Extract preference signals from normalized conversations.
 * Uses heuristic pattern matching — no LLM required.
 */
export function extractSignals(conversations: Conversation[]): ExtractedSignal[] {
  const prefs: PrefAccumulator = new Map()
  const maps: MapAccumulator = new Map()

  for (const conv of conversations) {
    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i]!
      if (msg.role !== 'user') continue

      if (detectCorrections(msg.content)) {
        extractStylePreferences(msg.content, conv.id, i, prefs)
        extractMeaningMaps(msg.content, conv.id, maps)
      }
    }
  }

  const signals: ExtractedSignal[] = []
  const platform: Platform = conversations[0]?.platform ?? 'custom'
  const today = new Date().toISOString().slice(0, 10)

  // Convert pref accumulators to signals
  for (const [, pref] of prefs) {
    const srcCounts: Partial<Record<string, number>> = {}
    srcCounts[platform] = pref.count

    signals.push({
      type: 'pref',
      data: {
        dim: pref.dim,
        target: pref.target,
        w: 0.5,
        n: pref.count,
        src: srcCounts,
        ctd: 0,
        scope: '*',
        decay: 1.0,
        last: today,
      },
      source: {
        conversationId: [...pref.sources][0]!,
        messageIndex: pref.messageIndices[0]!,
        platform,
      },
      occurrences: pref.count,
      confidence: pref.count >= 10 ? 1.0 : pref.count >= 5 ? 0.8 : 0.6,
    })
  }

  // Convert map accumulators to signals
  for (const [, map] of maps) {
    signals.push({
      type: 'map',
      data: {
        trigger: map.candidate.trigger,
        pattern_type: map.candidate.patternType,
        intent: map.candidate.intent,
        conf: map.count >= 10 ? 0.95 : map.count >= 5 ? 0.8 : 0.6,
        n: map.count,
        scope: '*',
        last: today,
      },
      source: {
        conversationId: [...map.sources][0]!,
        messageIndex: 0,
        platform,
      },
      occurrences: map.count,
      confidence: map.count >= 10 ? 1.0 : map.count >= 5 ? 0.8 : 0.6,
    })
  }

  return signals
}
