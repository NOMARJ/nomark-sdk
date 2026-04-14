import { type LedgerEntry, type SigPref, type SigMap, type SigAsn, isStylisticPref } from './schema.js'
import { effectiveWeight } from './decay.js'

// --- Scope specificity ---

export function scopeSpecificity(scope: string): number {
  if (scope === '*') return 0.3
  if (scope.includes('+')) return 1.0 // compound scope
  return 0.7 // single scope
}

/**
 * Check if a scope matches the given context/topic filter.
 * '*' matches everything. 'context:code' matches context=code.
 * Compound 'context:code+topic:auth' matches both.
 */
export function scopeMatches(scope: string, context?: string, topic?: string): boolean {
  if (scope === '*') return true

  const parts = scope.split('+')
  for (const part of parts) {
    const [key, value] = part.split(':') as [string, string | undefined]
    if (!key || !value) continue
    if (key === 'context' && context && value !== context) return false
    if (key === 'topic' && topic && value !== topic) return false
  }

  return true
}

// --- Resolver scoring (MEE Spec Section 1.2) ---

export type ScoredPref = SigPref & {
  _score: number
  _effective_w: number
  _factors: {
    specificity: number
    evidence: number
    recency: number
    stability: number
    portability: number
    contradiction_penalty: number
  }
}

/**
 * Score a preference entry using the five-factor weighted formula:
 *
 * Score = (S × 0.30) + (E × 0.25) + (R × 0.20) + (T × 0.15) + (P × 0.10) - C_p
 *
 * S = Specificity: scope match depth (compound=1.0, single=0.7, global=0.3)
 * E = Evidence: min(1.0, signal_count / 20)
 * R = Recency: max(0.0, 1.0 - days_since_last / 180)
 * T = Stability: 1.0 - (contradiction_count / max(signal_count, 1))
 * P = Portability: unique_context_count / total_context_count
 * C_p = Contradiction penalty: contradiction_count × 0.15
 */
export function resolverScore(pref: SigPref, now: Date = new Date()): ScoredPref {
  const last = new Date(pref.last)
  const daysSinceLast = Math.max(0, (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  const specificity = scopeSpecificity(pref.scope)
  const evidence = Math.min(1.0, pref.n / 20)
  const recency = Math.max(0, 1.0 - daysSinceLast / 180)
  const stability = pref.n > 0 ? 1.0 - (pref.ctd / pref.n) : 0.5

  let portability = 0
  if (pref.src) {
    portability = Object.values(pref.src).filter((v): v is number => (v ?? 0) > 0).length / 3
  }

  const contradictionPenalty = pref.ctd * 0.15

  const score =
    (specificity * 0.30) +
    (evidence * 0.25) +
    (recency * 0.20) +
    (stability * 0.15) +
    (portability * 0.10) -
    contradictionPenalty

  return {
    ...pref,
    _score: Math.round(score * 1000) / 1000,
    _effective_w: effectiveWeight(pref.w, pref.decay),
    _factors: {
      specificity,
      evidence,
      recency,
      stability,
      portability,
      contradiction_penalty: contradictionPenalty,
    },
  }
}

// --- Resolution types ---

export type ResolverConfig = {
  ledgerPath?: string
  ledgerContent?: string
  entries?: LedgerEntry[]
  context?: string
  topic?: string
  now?: Date
}

export type DimensionResult = {
  dimension: string
  winner: ScoredPref | null
  runnerUp: ScoredPref | null
  unstable: boolean
  action: 'use_winner' | 'ask'
  candidates: number
}

export type MeaningMapMatch = {
  trigger: string
  intent: string[]
  confidence: number
  scope: string
}

export type DefaultMatch = {
  field: string
  default: string
  accuracy: number
}

export type ResolverResult = {
  dimensions: Record<string, DimensionResult>
  meaningMaps: MeaningMapMatch[]
  defaults: DefaultMatch[]
  meta: {
    entryCount: number
    estimatedTokens: number
  }
}

// --- Resolver ---

function loadEntries(config: ResolverConfig): LedgerEntry[] {
  if (config.entries) return config.entries
  if (config.ledgerContent) {
    return parseLedgerContent(config.ledgerContent)
  }
  return []
}

function parseLedgerContent(content: string): LedgerEntry[] {
  // Inline parse to avoid circular dependency at module level
  const SIGNAL_PREFIX_RE = /^\[sig:(\w+)\]\s+(.+)$/
  const results: LedgerEntry[] = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(SIGNAL_PREFIX_RE)
    if (!match) continue
    try {
      const type = match[1] as 'meta' | 'pref' | 'map' | 'asn' | 'rub'
      const data = JSON.parse(match[2]!) as Record<string, unknown>
      results.push({ type, data } as LedgerEntry)
    } catch {
      // skip malformed
    }
  }
  return results
}

/**
 * Resolve a specific dimension from the ledger.
 *
 * Resolution order (Section 1.3):
 * 1. Explicit input (not handled here — caller provides overrides)
 * 2. Session context (not handled here — caller provides)
 * 3. Meaning maps (trigger matching)
 * 4. Scoped preferences (context/topic-specific)
 * 5. Global preferences (scope: *)
 * 6. Defaults (from [sig:asn] entries)
 * 7. Ask (only for unfilled fields)
 *
 * Instability detection: winner score < 0.4 = unstable dimension → ask instead.
 */
export function resolveDimension(
  entries: LedgerEntry[],
  dimension: string,
  context?: string,
  topic?: string,
  now: Date = new Date(),
): DimensionResult {
  const candidates = entries
    .filter((e): e is LedgerEntry & { type: 'pref'; data: SigPref } =>
      e.type === 'pref' && isStylisticPref(e.data) && e.data.dim === dimension && scopeMatches(e.data.scope, context, topic)
    )
    .map(e => resolverScore(e.data, now))
    .sort((a, b) => b._score - a._score)

  if (candidates.length === 0) {
    return {
      dimension,
      winner: null,
      runnerUp: null,
      unstable: false,
      action: 'ask',
      candidates: 0,
    }
  }

  const winner = candidates[0]!
  const runnerUp = candidates.length > 1 ? candidates[1]! : null
  const unstable = winner._score < 0.4

  return {
    dimension,
    winner,
    runnerUp,
    unstable,
    action: unstable ? 'ask' : 'use_winner',
    candidates: candidates.length,
  }
}

/**
 * Match input against meaning maps.
 * Current implementation: exact phrase match on trigger.
 */
export function matchMeaningMaps(
  entries: LedgerEntry[],
  input: string,
  context?: string,
  topic?: string,
): MeaningMapMatch[] {
  const normalizedInput = input.toLowerCase().trim()

  return entries
    .filter((e): e is LedgerEntry & { type: 'map'; data: SigMap } => e.type === 'map')
    .filter(e => {
      const scope = e.data.scope ?? '*'
      return normalizedInput.includes(e.data.trigger.toLowerCase()) && scopeMatches(scope, context, topic)
    })
    .map(e => ({
      trigger: e.data.trigger,
      intent: e.data.intent,
      confidence: e.data.conf,
      scope: e.data.scope ?? '*',
    }))
}

/**
 * Find applicable defaults from [sig:asn] entries.
 */
export function findDefaults(entries: LedgerEntry[]): DefaultMatch[] {
  return entries
    .filter((e): e is LedgerEntry & { type: 'asn'; data: SigAsn } => e.type === 'asn')
    .map(e => ({
      field: e.data.field,
      default: e.data.default,
      accuracy: e.data.accuracy,
    }))
}

/**
 * Create a resolver instance from configuration.
 * Returns a function that resolves intent from user input.
 */
export function createResolver(config: ResolverConfig) {
  const entries = loadEntries(config)
  const now = config.now ?? new Date()
  const context = config.context
  const topic = config.topic

  return {
    /**
     * Resolve a single dimension.
     */
    resolve(dimension: string): DimensionResult {
      return resolveDimension(entries, dimension, context, topic, now)
    },

    /**
     * Resolve all preference dimensions found in the ledger.
     */
    resolveAll(): ResolverResult {
      const dimensions = new Set<string>()
      for (const entry of entries) {
        if (entry.type === 'pref' && isStylisticPref(entry.data)) {
          dimensions.add(entry.data.dim)
        }
      }

      const results: Record<string, DimensionResult> = {}
      for (const dim of dimensions) {
        results[dim] = resolveDimension(entries, dim, context, topic, now)
      }

      return {
        dimensions: results,
        meaningMaps: [],
        defaults: findDefaults(entries),
        meta: {
          entryCount: entries.length,
          estimatedTokens: entries.length * 75,
        },
      }
    },

    /**
     * Resolve intent from natural language input.
     * Combines meaning map matching with preference resolution.
     */
    resolveInput(input: string): ResolverResult {
      const dimensions = new Set<string>()
      for (const entry of entries) {
        if (entry.type === 'pref' && isStylisticPref(entry.data)) {
          dimensions.add(entry.data.dim)
        }
      }

      const dimResults: Record<string, DimensionResult> = {}
      for (const dim of dimensions) {
        dimResults[dim] = resolveDimension(entries, dim, context, topic, now)
      }

      return {
        dimensions: dimResults,
        meaningMaps: matchMeaningMaps(entries, input, context, topic),
        defaults: findDefaults(entries),
        meta: {
          entryCount: entries.length,
          estimatedTokens: entries.length * 75,
        },
      }
    },

    /**
     * Get the raw ledger entries.
     */
    entries(): LedgerEntry[] {
      return [...entries]
    },
  }
}
