/**
 * Trust Contract (MEE Spec Module 4).
 *
 * Governs agent autonomy based on demonstrated reliability.
 */

export type BreachSeverity = 'S0' | 'S1' | 'S2' | 'S3' | 'S4'

export type AutonomyLevel = 'probation' | 'restricted' | 'supervised' | 'trusted' | 'full'

export type StoryScope = 'trivial' | 'moderate' | 'complex'

export type BreachEvent = {
  severity: BreachSeverity
  description: string
  timestamp: string
}

export type TrustEarning = {
  scope: StoryScope
  storyId: string
  timestamp: string
}

export type TrustState = {
  score: number
  level: AutonomyLevel
  breaches: Record<BreachSeverity, number>
  storiesVerified: number
  commends: number
  history: Array<{ delta: number; reason: string; timestamp: string }>
}

const BREACH_PENALTIES: Record<BreachSeverity, number> = {
  S0: -0.01,
  S1: -0.05,
  S2: -0.15,
  S3: -0.50,
  S4: -1.00,
}

const SCOPE_REWARDS: Record<StoryScope, number> = {
  trivial: 0.02,
  moderate: 0.05,
  complex: 0.10,
}

export function getAutonomyLevel(score: number): AutonomyLevel {
  if (score >= 1.5) return 'full'
  if (score >= 1.0) return 'trusted'
  if (score >= 0.5) return 'supervised'
  if (score >= 0.2) return 'restricted'
  return 'probation'
}

export function createTrustContract(initialScore = 0.5): TrustState {
  return {
    score: initialScore,
    level: getAutonomyLevel(initialScore),
    breaches: { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 },
    storiesVerified: 0,
    commends: 0,
    history: [],
  }
}

export function recordBreach(state: TrustState, event: BreachEvent): TrustState {
  const penalty = BREACH_PENALTIES[event.severity]
  const newScore = event.severity === 'S4'
    ? 0
    : Math.max(0, state.score + penalty)

  const breaches = { ...state.breaches }
  breaches[event.severity]++

  return {
    ...state,
    score: Math.round(newScore * 1000) / 1000,
    level: getAutonomyLevel(newScore),
    breaches,
    history: [...state.history, {
      delta: penalty,
      reason: `${event.severity}: ${event.description}`,
      timestamp: event.timestamp,
    }],
  }
}

export function recordVerification(state: TrustState, earning: TrustEarning): TrustState {
  const reward = SCOPE_REWARDS[earning.scope]
  const newScore = state.score + reward

  return {
    ...state,
    score: Math.round(newScore * 1000) / 1000,
    level: getAutonomyLevel(newScore),
    storiesVerified: state.storiesVerified + 1,
    history: [...state.history, {
      delta: reward,
      reason: `verified ${earning.scope}: ${earning.storyId}`,
      timestamp: earning.timestamp,
    }],
  }
}

export function recordCommend(state: TrustState, reason: string, timestamp: string): TrustState {
  const newScore = state.score + 0.20

  return {
    ...state,
    score: Math.round(newScore * 1000) / 1000,
    level: getAutonomyLevel(newScore),
    commends: state.commends + 1,
    history: [...state.history, {
      delta: 0.20,
      reason: `commend: ${reason}`,
      timestamp,
    }],
  }
}
