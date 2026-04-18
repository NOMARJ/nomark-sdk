/**
 * NOMARK Intents resolvers — compute-side emitters.
 *
 * `resolve(composition, target)` picks a backend by target tag and returns the
 * emitted source(s). Each backend is a subclass of BaseResolver; register them
 * in the RESOLVERS map below.
 *
 * The 20 compute verbs are handled per target. The 11 surface verbs (MONITOR,
 * DISPLAY, etc.) are stripped with a warning — a separate surface resolver pass
 * consumes those, not this one.
 */

import { BaseResolver, type ResolverOutput } from './core/resolver.js'
import type { Composition, TargetTag } from './core/ir.js'

export type ResolveTarget = NonNullable<TargetTag['compute']> | TargetTag

/** Backend registry. Populated by RES-002..005. */
const RESOLVERS = new Map<string, () => BaseResolver>()

export function registerResolver(label: string, factory: () => BaseResolver): void {
  RESOLVERS.set(label, factory)
}

/** Normalise a caller-supplied target into a compute label. */
function labelOf(target: ResolveTarget): string {
  if (typeof target === 'string') return target
  if (target.compute) return target.compute
  throw new Error('resolve(): target has no compute tag')
}

/**
 * Resolve a composition for a specific compute target.
 *
 * Throws if no backend is registered for the target label. Known labels:
 * 'typescript', 'python', 'rust', 'sql-postgres', 'sql-sqlite', 'sql-mysql'.
 */
export function resolve(composition: Composition, target: ResolveTarget): ResolverOutput {
  const label = labelOf(target)
  const factory = RESOLVERS.get(label)
  if (!factory) {
    const known = [...RESOLVERS.keys()].sort().join(', ') || '(none registered)'
    throw new Error(`resolve(): no backend registered for target '${label}'. Known: ${known}`)
  }
  return factory().resolve(composition)
}

/** List registered backend labels. */
export function availableTargets(): string[] {
  return [...RESOLVERS.keys()].sort()
}

// Public IR surface
export type {
  Composition, TargetTag, Verb, VerbName, ComputeVerb, SurfaceVerb,
  EntityDecl, EntityRole,
} from './core/ir.js'
export { mapExpr, reduceExpr, partitionVerbs, isSurfaceVerb } from './core/ir.js'

// Public resolver surface (for external backend authors)
export {
  BaseResolver,
  type VerbHandler, type ResolverContext,
  type ResolverOutput, type ResolverFile, type ResolverWarning,
} from './core/resolver.js'
