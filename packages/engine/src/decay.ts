/**
 * Continuous decay computation (MEE Spec Section 8).
 *
 * Base: max(0.1, 0.98^(days/30))
 * Contradiction acceleration: decay * 0.85 when recentContradictions >= 2
 * Reinforcement recovery: decay * 1.1 (capped 1.0) when reinforced within 7 days
 * Floor: 0.1 — never total erasure
 */
export function computeDecay(
  lastDate: string,
  _contradictions: number,
  recentContradictions: number,
  recentReinforcement: boolean,
  now: Date = new Date(),
): number {
  const last = new Date(lastDate)
  const daysSinceLast = Math.max(0, (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  let decay = Math.max(0.1, Math.pow(0.98, daysSinceLast / 30))

  if (recentContradictions >= 2) {
    decay = Math.max(0.1, decay * 0.85)
  }

  if (recentReinforcement) {
    decay = Math.min(1.0, decay * 1.1)
  }

  return Math.round(decay * 1000) / 1000
}

/**
 * Effective weight after decay application.
 */
export function effectiveWeight(w: number, decay: number): number {
  return Math.round(w * decay * 1000) / 1000
}
