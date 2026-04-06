/**
 * Instinct Engine (MEE Spec Module 5).
 *
 * Pattern capture and confidence lifecycle.
 */

export type InstinctStatus = 'pending' | 'proven' | 'promoted' | 'rejected'

export type Instinct = {
  id: string
  pattern: string
  tags: string[]
  confidence: number
  observations: number
  status: InstinctStatus
  createdAt: string
  lastUsed?: string
  parentId?: string
}

export type InstinctStore = {
  instincts: Map<string, Instinct>
}

export function createInstinctStore(): InstinctStore {
  return { instincts: new Map() }
}

export function captureInstinct(
  store: InstinctStore,
  id: string,
  pattern: string,
  tags: string[],
  timestamp: string,
): InstinctStore {
  const instinct: Instinct = {
    id,
    pattern,
    tags,
    confidence: 0.3,
    observations: 1,
    status: 'pending',
    createdAt: timestamp,
  }

  const instincts = new Map(store.instincts)
  instincts.set(id, instinct)
  return { instincts }
}

export function confirmInstinct(store: InstinctStore, id: string): InstinctStore {
  const instinct = store.instincts.get(id)
  if (!instinct) return store

  const newConf = Math.min(1.0, instinct.confidence + 0.3)
  const newObs = instinct.observations + 1
  const newStatus: InstinctStatus = newConf >= 0.7 ? 'proven' : instinct.status

  const instincts = new Map(store.instincts)
  instincts.set(id, { ...instinct, confidence: newConf, observations: newObs, status: newStatus })
  return { instincts }
}

export function rejectInstinct(store: InstinctStore, id: string): InstinctStore {
  const instinct = store.instincts.get(id)
  if (!instinct) return store

  const newConf = Math.max(0, instinct.confidence - 0.4)
  const newStatus: InstinctStatus = newConf < 0.2 ? 'rejected' : instinct.status

  const instincts = new Map(store.instincts)
  instincts.set(id, { ...instinct, confidence: newConf, status: newStatus })
  return { instincts }
}

export function decayInstincts(store: InstinctStore, daysSinceLastUse: number): InstinctStore {
  const decayPer30Days = 0.1
  const periods = daysSinceLastUse / 30
  const decay = periods * decayPer30Days

  const instincts = new Map<string, Instinct>()
  for (const [id, instinct] of store.instincts) {
    if (instinct.status === 'promoted' || instinct.status === 'rejected') {
      instincts.set(id, instinct)
      continue
    }

    const newConf = Math.max(0, instinct.confidence - decay)
    const newStatus: InstinctStatus = newConf < 0.2 ? 'rejected' : instinct.status
    instincts.set(id, { ...instinct, confidence: Math.round(newConf * 1000) / 1000, status: newStatus })
  }

  return { instincts }
}

/**
 * Find clusters of 3+ proven instincts with overlapping tags.
 * Returns tag clusters that are candidates for skill promotion.
 */
export function findPromotionCandidates(store: InstinctStore): Array<{ tag: string; instincts: Instinct[] }> {
  const proven = [...store.instincts.values()].filter(i => i.status === 'proven')
  const tagMap = new Map<string, Instinct[]>()

  for (const instinct of proven) {
    for (const tag of instinct.tags) {
      const existing = tagMap.get(tag) ?? []
      existing.push(instinct)
      tagMap.set(tag, existing)
    }
  }

  return [...tagMap.entries()]
    .filter(([, instincts]) => instincts.length >= 3)
    .map(([tag, instincts]) => ({ tag, instincts }))
}
