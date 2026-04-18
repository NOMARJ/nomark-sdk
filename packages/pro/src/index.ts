import {
  createResolver, type ResolverConfig, type ResolverResult,
} from '@nomark-ai/engine'
import { createTrustContract, type TrustState } from './trust.js'
import { createInstinctStore, type InstinctStore } from './instincts.js'
import { createLifecycle, CODE_LIFECYCLE, type LifecycleInstance, type LifecycleConfig } from './governance.js'
import { evaluateGate, type GateResult, type RequestTypeSchema } from './critical-gate.js'

// Re-export all module types and functions
export * from './trust.js'
export * from './instincts.js'
export {
  type LifecycleStage, type LifecycleConfig, type StageStatus,
  type LifecycleInstance, type AuditEntry,
  createLifecycle, checkTrustGate, advanceStage, recordArtifact,
  recordVerification as recordLifecycleVerification,
  isComplete, currentStageName, CODE_LIFECYCLE,
} from './governance.js'
export * from './critical-gate.js'

// --- Team Sync ---
export { createTeamSync, type TeamSync, type TeamSyncConfig } from './team-sync.js'
export { createTeam, inviteMember, removeMember, setTeamPreference, type TeamAdminConfig } from './team-admin.js'

// --- Intent resolvers (compute-side code emitters) ---
export {
  resolve, registerResolver, availableTargets, BaseResolver,
  type ResolveTarget, type Composition, type TargetTag, type Verb, type VerbName,
  type ComputeVerb, type SurfaceVerb, type EntityDecl, type EntityRole,
  type VerbHandler, type ResolverContext,
  type ResolverOutput, type ResolverFile, type ResolverWarning,
  mapExpr, reduceExpr, partitionVerbs, isSurfaceVerb,
} from './resolvers/index.js'
export {
  resolveAll,
  type Manifest, type ManifestFileEntry, type ManifestTargetEntry,
  type ResolveAllOptions,
} from './resolvers/manifest.js'

// --- Engine configuration ---

export type EngineConfig = ResolverConfig & {
  trust?: boolean
  instincts?: boolean
  governance?: boolean | LifecycleConfig
  criticalFields?: boolean
  customSchemas?: Record<string, RequestTypeSchema>
  licenseKey?: string
}

export type EngineResult = ResolverResult & {
  trust?: TrustState
  gate?: GateResult[]
}

/**
 * Create a full NOMARK Pro engine.
 * Wraps the free-tier resolver with trust, instincts, governance, and critical-field gate.
 */
export function createEngine(config: EngineConfig) {
  const resolver = createResolver(config)
  const trust = config.trust ? createTrustContract() : undefined
  const instincts = config.instincts ? createInstinctStore() : undefined

  const lifecycleConfig = typeof config.governance === 'object'
    ? config.governance
    : config.governance ? CODE_LIFECYCLE : undefined
  const lifecycle = lifecycleConfig
    ? createLifecycle(lifecycleConfig, new Date().toISOString())
    : undefined

  let currentTrust = trust
  let currentInstincts = instincts
  let currentLifecycle = lifecycle

  return {
    /**
     * Process input through the full engine.
     * Resolves preferences, checks critical-field gates, returns enriched result.
     */
    process(input: string, options: { schema?: string; fields?: string[] } = {}): EngineResult {
      const resolverResult = resolver.resolveInput(input)

      let gate: GateResult[] | undefined
      if (config.criticalFields && options.schema && options.fields) {
        gate = evaluateGate(options.fields, options.schema, config.customSchemas)
      }

      return {
        ...resolverResult,
        trust: currentTrust,
        gate,
      }
    },

    /** Resolve a single dimension */
    resolve: resolver.resolve.bind(resolver),

    /** Resolve all dimensions */
    resolveAll: resolver.resolveAll.bind(resolver),

    /** Get raw entries */
    entries: resolver.entries.bind(resolver),

    /** Get current trust state */
    getTrust(): TrustState | undefined {
      return currentTrust
    },

    /** Get current instinct store */
    getInstincts(): InstinctStore | undefined {
      return currentInstincts
    },

    /** Get current lifecycle instance */
    getLifecycle(): LifecycleInstance | undefined {
      return currentLifecycle
    },

    /** Update trust state (returns new engine, immutable) */
    withTrust(newTrust: TrustState) {
      currentTrust = newTrust
    },

    /** Update instinct store */
    withInstincts(newInstincts: InstinctStore) {
      currentInstincts = newInstincts
    },

    /** Update lifecycle instance */
    withLifecycle(newLifecycle: LifecycleInstance) {
      currentLifecycle = newLifecycle
    },
  }
}
