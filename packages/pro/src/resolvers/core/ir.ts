/**
 * Resolver IR (Intermediate Representation).
 *
 * Shared intent shape consumed by every compute backend. Structurally compatible
 * with `@nomark/intents` ComposedUnit, but self-contained so the pro package can
 * ship independently of the open SDK.
 *
 * The IR is authored by `compose()` on the intents side and fed to `resolve()`
 * here. Resolvers extend `BaseResolver` (core/resolver.ts) and supply a handler
 * per verb; the base class drives the dispatch loop.
 */

/** The 20 compute verbs emitted by resolvers. Surface verbs (21-31) are stripped. */
export type ComputeVerb =
  | 'FETCH' | 'MAP' | 'FILTER' | 'REDUCE' | 'ENRICH' | 'PERSIST' | 'DELETE' | 'STREAM'
  | 'AWAIT' | 'BRANCH' | 'SPLIT' | 'MERGE' | 'GATE' | 'SIGNAL' | 'TERMINATE'
  | 'RETRY' | 'COMPENSATE' | 'ERROR'
  | 'VALIDATE'
  | 'EMIT'

/** The 11 surface verbs. Resolvers strip these and warn with a count per spec §5.2. */
export type SurfaceVerb =
  | 'MONITOR' | 'DECIDE' | 'CONFIGURE' | 'EXPLORE' | 'AUTHOR' | 'ONBOARD'
  | 'DISPLAY' | 'COLLECT' | 'ARRANGE'
  | 'STATUS' | 'GUIDE'

export type VerbName = ComputeVerb | SurfaceVerb | 'COMPOSE'

export type Verb = {
  id: string
  verb: VerbName
  params?: Record<string, unknown>
  entity?: string
  next?: string
}

export type EntityRole = 'primary' | 'affected' | 'observed'

export type EntityDecl = {
  schema: unknown
  role: EntityRole
}

export type TargetTag = {
  compute?: 'typescript' | 'python' | 'rust' | 'sql-postgres' | 'sql-sqlite' | 'sql-mysql' | 'sql' | string
  surface?: string
  design?: string
}

export type Composition = {
  name: string
  version: string
  description?: string
  input_schema?: unknown
  output_schema?: unknown
  entities?: Record<string, EntityDecl>
  verbs: Verb[]
  error_policy?: { default?: { action: string; target?: string } }
  compensations?: Record<string, string>
  budget?: { max_verbs?: number; max_external_calls?: number; max_parallel?: number }
  target?: TargetTag
}

/** ------------------------------------------------------------------------
 * Expression normalisers.
 *
 * `MAP` and `REDUCE` accept two authoring shapes per spec §3.1:
 *
 *   1. Raw:        { expression: '...' }                  — opaque string for the target
 *   2. Structured: { project: { a: '...', b: '...' } }    — MAP
 *                  { group_by: ['k'], agg: { s: 'sum(x)' } } — REDUCE
 *
 * TS/Python/Rust runtimes want a single expression string (the mini-language
 * each resolver chose — JS for TS, Python eval for Python, custom for Rust).
 * The structured form is collapsed into an object-literal expression that
 * travels through that mini-language unchanged.
 *
 * SQL backends do NOT use these normalisers — they have native helpers in
 * resolvers/sql/base.ts because JS-style `{ a: x, b: y }` is not valid SQL.
 * ----------------------------------------------------------------------- */

type MapParams = {
  expression?: string
  project?: Record<string, string>
  select?: Record<string, string>
}

type ReduceParams = {
  expression?: string
  group_by?: string | string[]
  agg?: Record<string, string>
  initial?: unknown
}

/** Collapse a MAP verb's params into a single expression string. */
export function mapExpr(params: Record<string, unknown> | undefined): string {
  const p = (params ?? {}) as MapParams
  if (typeof p.expression === 'string') return p.expression
  const projection = p.project ?? p.select
  if (projection && typeof projection === 'object') {
    const pairs = Object.entries(projection).map(([k, v]) => `${JSON.stringify(k)}: (${v})`)
    return `({ ${pairs.join(', ')} })`
  }
  return 'row'
}

/**
 * Collapse a REDUCE verb's params into a single expression string of the form
 * `group_by(<key>).<op>(<field>)`. Multi-aggregate forms are represented as
 * the FIRST aggregate — downstream runtimes emit one aggregate per REDUCE call
 * per spec §3.1. SQL handles multi-aggregate natively via its own helper.
 */
export function reduceExpr(params: Record<string, unknown> | undefined): string {
  const p = (params ?? {}) as ReduceParams
  if (typeof p.expression === 'string') return p.expression
  if (p.agg && typeof p.agg === 'object') {
    const key = Array.isArray(p.group_by) ? p.group_by[0] : p.group_by
    const firstEntry = Object.entries(p.agg)[0]
    if (firstEntry && key) {
      const [, aggExpr] = firstEntry
      return `group_by(${key}).${aggExpr}`
    }
  }
  return 'row'
}

/** Split a composition's verbs into compute + surface buckets. */
export function partitionVerbs(c: Composition): { compute: Verb[]; surface: Verb[] } {
  const compute: Verb[] = []
  const surface: Verb[] = []
  for (const v of c.verbs) {
    if (isSurfaceVerb(v.verb)) surface.push(v)
    else compute.push(v)
  }
  return { compute, surface }
}

const SURFACE_SET: ReadonlySet<string> = new Set<SurfaceVerb>([
  'MONITOR', 'DECIDE', 'CONFIGURE', 'EXPLORE', 'AUTHOR', 'ONBOARD',
  'DISPLAY', 'COLLECT', 'ARRANGE',
  'STATUS', 'GUIDE',
])

export function isSurfaceVerb(name: string): boolean {
  return SURFACE_SET.has(name)
}

/** The 7 flow-category compute verbs. Their presence in a composition flips
 *  the dispatcher emission from linear-chain to graph form. */
const FLOW_SET: ReadonlySet<string> = new Set<ComputeVerb>([
  'AWAIT', 'BRANCH', 'SPLIT', 'MERGE', 'GATE', 'SIGNAL', 'TERMINATE',
])

export function isFlowVerb(name: string): boolean {
  return FLOW_SET.has(name)
}

export function hasFlowVerbs(c: Composition): boolean {
  return c.verbs.some((v) => isFlowVerb(v.verb))
}

/** Verbs that handle their own dispatch internally — the dispatcher case
 *  emits `return;` after the body rather than chaining to a linear next.
 *  BRANCH routes to one of N conditional targets and never returns to the
 *  linear chain; TERMINATE throws and never returns. SPLIT does dispatch
 *  to its children internally but afterwards the linear chain continues
 *  (typically into a MERGE), so SPLIT is NOT self-dispatching here. */
const SELF_DISPATCHING: ReadonlySet<string> = new Set<string>([
  'BRANCH', 'TERMINATE',
])

export function isSelfDispatching(name: string): boolean {
  return SELF_DISPATCHING.has(name)
}

/** Collect all verb ids that appear as SPLIT targets across a composition.
 *  These verbs are reachable only via SPLIT; they are excluded from the
 *  linear chain in graph form. */
export function splitChildIds(c: Composition): Set<string> {
  const out = new Set<string>()
  for (const v of c.verbs) {
    if (v.verb !== 'SPLIT') continue
    const targets = (v.params as { targets?: unknown })?.targets
    if (Array.isArray(targets)) {
      for (const t of targets) if (typeof t === 'string') out.add(t)
    }
  }
  return out
}

/** Compute the linear successor for each verb in a composition under graph
 *  form. The rules:
 *  - Self-dispatching verbs (BRANCH, SPLIT, TERMINATE) have no linear next —
 *    their body handles dispatch internally.
 *  - SPLIT-children have no linear next — only invoked by SPLIT.
 *  - Other verbs use their explicit `next` field if set; otherwise fall back
 *    to the next-in-array verb that is NOT a flow-target. This default works
 *    for the simple "chain to next non-special verb" case while letting
 *    branch-target subchains terminate cleanly via explicit `next: null`
 *    (omitting the field).
 *  Returns Map<verb_id, next_verb_id_or_null>. The first verb is entrypoint. */
export function buildLinearChain(c: Composition): {
  entry: string | null
  next: Map<string, string | null>
} {
  const children = splitChildIds(c)
  const flowTargets = new Set<string>()
  for (const v of c.verbs) {
    if (v.verb === 'BRANCH') {
      const conds = (v.params as { conditions?: { then?: string }[] })?.conditions ?? []
      for (const c of conds) if (c.then) flowTargets.add(c.then)
      const def = (v.params as { default?: string })?.default
      if (def) flowTargets.add(def)
    }
  }
  // Branch-targets and SPLIT-children are "flow targets". They are not part
  // of the linear backbone; they are reachable only via flow verbs.
  for (const cid of children) flowTargets.add(cid)

  const next = new Map<string, string | null>()
  for (const v of c.verbs) {
    if (isSelfDispatching(v.verb)) {
      next.set(v.id, null)
      continue
    }
    if (typeof v.next === 'string') {
      next.set(v.id, v.next)
      continue
    }
    // Verbs that are themselves flow targets (BRANCH conditional targets,
    // SPLIT children) default to no linear next — they live in subchains
    // wired explicitly via `next` if they continue, else terminate.
    if (flowTargets.has(v.id)) {
      next.set(v.id, null)
      continue
    }
    // Default: next-in-array that is NOT a flow target
    const idx = c.verbs.findIndex((x) => x.id === v.id)
    let nx: string | null = null
    for (let j = idx + 1; j < c.verbs.length; j++) {
      const cand = c.verbs[j]!
      if (!flowTargets.has(cand.id)) {
        nx = cand.id
        break
      }
    }
    next.set(v.id, nx)
  }

  // The entry is the first verb that is not a flow target.
  const entry = c.verbs.find((v) => !flowTargets.has(v.id))?.id ?? null
  return { entry, next }
}
