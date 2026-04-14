import { type LedgerEntry, type SigPref, isStylisticPref } from './schema.js'
import { resolverScore, type ScoredPref } from './resolver.js'
import { effectiveWeight } from './decay.js'

export type ContradictionResolution = {
  recommended: ScoredPref
  reason: string
  margin: number
}

export type Contradiction = {
  id: string
  dimension: string
  scope: string
  entries: ScoredPref[]
  resolution: ContradictionResolution
}

export type DetectContradictionsOptions = {
  now?: Date
  /**
   * Minimum effective weight (w × decay) for an entry to be considered.
   * Entries below this threshold are treated as stale and filtered out.
   * Default: 0.1 — matches the decay floor in computeDecay.
   */
  minEffectiveWeight?: number
}

/**
 * Detect contradictions within a ledger of signal entries.
 *
 * A contradiction exists when two or more `pref` entries share the same
 * `dim` and the same `scope` but disagree on `target`. Entries with
 * different scopes are treated as scoped overrides — the more specific
 * scope wins cleanly in its own application region — and are NOT flagged.
 *
 * Each contradiction carries a resolution recommendation: the entry with
 * the highest resolver score (five-factor weighted formula from
 * `resolverScore`) wins. The `reason` field explains why, and `margin`
 * gives the score gap between winner and runner-up (useful for confidence
 * tiebreaks).
 *
 * Stale entries whose effective weight (w × decay) falls below
 * `minEffectiveWeight` are excluded from detection before grouping.
 */
export function detectContradictions(
  entries: LedgerEntry[],
  options: DetectContradictionsOptions = {},
): Contradiction[] {
  const now = options.now ?? new Date()
  const minEffectiveWeight = options.minEffectiveWeight ?? 0.1

  const active: SigPref[] = []
  for (const entry of entries) {
    if (entry.type !== 'pref') continue
    if (!isStylisticPref(entry.data)) continue
    const ew = effectiveWeight(entry.data.w, entry.data.decay)
    if (ew < minEffectiveWeight) continue
    active.push(entry.data)
  }

  const groups = new Map<string, SigPref[]>()
  for (const pref of active) {
    const key = `${pref.dim}\u0000${pref.scope}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(pref)
    else groups.set(key, [pref])
  }

  const contradictions: Contradiction[] = []
  for (const [, group] of groups) {
    if (group.length < 2) continue
    const uniqueTargets = new Set(group.map(p => p.target))
    if (uniqueTargets.size < 2) continue

    const scored = group
      .map(p => resolverScore(p, now))
      .sort((a, b) => b._score - a._score)

    const winner = scored[0]!
    const runnerUp = scored[1]!
    const margin = Math.round((winner._score - runnerUp._score) * 1000) / 1000

    const reason =
      margin > 0.05
        ? `winner "${winner.target}" beats "${runnerUp.target}" by ${margin} (score ${winner._score} vs ${runnerUp._score})`
        : `confidence tiebreak: "${winner.target}" (score ${winner._score}) narrowly beats "${runnerUp.target}" (score ${runnerUp._score}) — margin ${margin}`

    contradictions.push({
      id: `ctd-${winner.dim}-${sanitizeScope(winner.scope)}`,
      dimension: winner.dim,
      scope: winner.scope,
      entries: scored,
      resolution: {
        recommended: winner,
        reason,
        margin,
      },
    })
  }

  return contradictions
}

function sanitizeScope(scope: string): string {
  return scope.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'global'
}
