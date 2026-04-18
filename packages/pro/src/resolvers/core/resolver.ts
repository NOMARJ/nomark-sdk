/**
 * BaseResolver — the contract every compute backend implements.
 *
 * Each backend extends this class and supplies a handler per compute verb.
 * The base class drives the dispatch loop, applies the structural emit wrapper
 * (preamble / body / postamble), strips surface verbs with a count warning,
 * and accumulates diagnostics.
 */

import { partitionVerbs, type Composition, type ComputeVerb, type Verb } from './ir.js'

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

  /** Compute-verb handlers. Subclasses populate this in their constructor. */
  protected handlers: Partial<Record<ComputeVerb, VerbHandler>> = {}

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

  resolve(composition: Composition): ResolverOutput {
    const warnings: ResolverWarning[] = []
    const { compute, surface } = partitionVerbs(composition)

    if (surface.length > 0) {
      warnings.push({
        code: 'SURFACE_VERBS_STRIPPED',
        message: `${surface.length} surface verb(s) removed — compute resolver only handles verbs 1-20`,
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

    for (const verb of compute) {
      const handler = this.handlers[verb.verb as ComputeVerb]
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

    const body = emitted.join('\n')
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
