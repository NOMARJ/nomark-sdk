/**
 * BaseResolver — the contract every resolver backend implements.
 *
 * Each backend extends this class and supplies a handler per verb it handles.
 * The base class drives the dispatch loop, applies the structural emit wrapper
 * (preamble / body / postamble), strips non-handled verbs with a count warning,
 * and accumulates diagnostics.
 *
 * Default behaviour handles the 20 compute verbs and strips the 11 surface
 * verbs. Surface backends override `targetVerbs()` + `handlerKind()` to flip
 * the buckets. See `SurfaceBackend` (react) for a concrete override.
 */

import { partitionVerbs, type Composition, type ComputeVerb, type SurfaceVerb, type Verb } from './ir.js'

export type ResolverWarning = {
  code: string
  message: string
  verb_id?: string
}

export type ResolverFile = {
  /** Target-relative path, e.g. 'daily_fund_flow_etl.ts' or 'Cargo.toml'. */
  path: string
  content: string
}

export type ResolverOutput = {
  /** Canonical label identifying the backend — 'typescript', 'sql-postgres', etc. */
  label: string
  files: ResolverFile[]
  warnings: ResolverWarning[]
}

/** Per-verb handler signature. Returns the emitted source fragment for that verb. */
export type VerbHandler = (verb: Verb, ctx: ResolverContext) => string

export type ResolverContext = {
  composition: Composition
  emit: (s: string) => void
  warn: (w: ResolverWarning) => void
  /** Look up a peer verb by id (for BRANCH/MERGE/RETRY references). */
  verbById: (id: string) => Verb | undefined
}

export abstract class BaseResolver {
  abstract readonly label: string

  /** Per-verb handlers. Subclasses populate this in their constructor.
   *  Type covers both compute and surface verbs so a single base class can
   *  serve both resolver families. Compute backends register compute verbs;
   *  surface backends register surface verbs. Nothing enforces the kinds
   *  match `handlerKind()` at the type level — the dispatch loop naturally
   *  emits `VERB_UNHANDLED` for mismatches. */
  protected handlers: Partial<Record<ComputeVerb | SurfaceVerb, VerbHandler>> = {}

  /** Emit the module-level preamble (imports, helpers, Ctx type). */
  protected abstract emitPreamble(c: Composition): string

  /** Emit the module-level postamble (exec entrypoint, exports). */
  protected abstract emitPostamble(c: Composition): string

  /** Emit the root source file path — backends override for extension/naming. */
  protected abstract rootFileName(c: Composition): string

  /** Emit any companion files (Cargo.toml, etc.). Default: none. */
  protected emitCompanionFiles(_c: Composition): ResolverFile[] {
    return []
  }

  /**
   * Separator inserted between per-verb handler outputs when composing the body.
   * Default `'\n'` — combined with each handler's single trailing newline, yields
   * one blank line between verbs. Python overrides to `'\n\n'` to match PEP 8
   * two-blank-line convention between top-level async defs.
   */
  protected bodySeparator(): string {
    return '\n'
  }

  /** Which family of verbs this backend handles. Surface backends override to `'surface'`.
   *  Only used in the `VERBS_STRIPPED` warning message — does not gate dispatch. */
  protected handlerKind(): 'compute' | 'surface' {
    return 'compute'
  }

  /** Split the composition's verbs into the bucket this backend handles vs. the
   *  bucket it strips. Default: compute-handled, surface-stripped. Surface
   *  backends flip to surface-handled, compute-stripped. Neither bucket ever
   *  includes the `COMPOSE` grammar verb — nested compositions are flattened
   *  by callers before `resolve()`. */
  protected targetVerbs(c: Composition): { handled: Verb[]; stripped: Verb[] } {
    const { compute, surface } = partitionVerbs(c)
    return { handled: compute, stripped: surface }
  }

  resolve(composition: Composition): ResolverOutput {
    const warnings: ResolverWarning[] = []
    const { handled, stripped } = this.targetVerbs(composition)

    if (stripped.length > 0) {
      const kind = this.handlerKind()
      warnings.push({
        code: 'VERBS_STRIPPED',
        message: `${stripped.length} non-handled verb(s) removed — ${this.label} resolver handles only ${kind} verbs`,
      })
    }

    const byId = new Map<string, Verb>(composition.verbs.map(v => [v.id, v]))
    const emitted: string[] = []
    const ctx: ResolverContext = {
      composition,
      emit: (s: string) => { emitted.push(s) },
      warn: (w: ResolverWarning) => { warnings.push(w) },
      verbById: (id: string) => byId.get(id),
    }

    for (const verb of handled) {
      const handler = this.handlers[verb.verb as ComputeVerb | SurfaceVerb]
      if (!handler) {
        warnings.push({
          code: 'VERB_UNHANDLED',
          message: `${this.label} resolver has no handler for verb ${verb.verb}`,
          verb_id: verb.id,
        })
        continue
      }
      emitted.push(handler(verb, ctx))
    }

    const body = emitted.join(this.bodySeparator())
    const content = [this.emitPreamble(composition), body, this.emitPostamble(composition)]
      .filter(s => s.length > 0)
      .join('\n')

    return {
      label: this.label,
      files: [
        { path: this.rootFileName(composition), content },
        ...this.emitCompanionFiles(composition),
      ],
      warnings,
    }
  }
}
