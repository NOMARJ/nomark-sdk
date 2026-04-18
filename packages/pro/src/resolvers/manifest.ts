import { resolve as resolveComposition } from './index.js'
import type { Composition } from './core/ir.js'

export type ManifestFileEntry = {
  path: string
  bytes: number
}

export type ManifestTargetEntry = {
  label: string
  files: ManifestFileEntry[]
  warnings: string[]
}

export type Manifest = {
  composition: string
  version: string
  generated_at: string
  targets: ManifestTargetEntry[]
}

export type ResolveAllOptions = {
  /** Prefix prepended to every `<label>/<file>` path. Empty means relative paths. */
  basePath?: string
  /** Clock for `generated_at`. Injectable so tests pin a deterministic timestamp. */
  clock?: () => Date
}

/**
 * Resolve a composition across multiple compute targets and aggregate results
 * into a manifest — the same shape as `__fixtures__/expected/manifest.json`.
 * Warnings are flattened to their message strings.
 */
export function resolveAll(
  composition: Composition,
  labels: string[],
  opts: ResolveAllOptions = {},
): Manifest {
  const base = opts.basePath ?? ''
  const clock = opts.clock ?? (() => new Date())

  const targets: ManifestTargetEntry[] = labels.map((label) => {
    const output = resolveComposition(composition, label)
    return {
      label,
      files: output.files.map((f) => ({
        path: base ? `${base}/${label}/${f.path}` : `${label}/${f.path}`,
        // Character count, NOT utf8 byte count — matches fixture manifest convention.
        // The TS fixture has em dashes + section signs that make utf8 byteLength
        // larger than string.length; the canonical manifest uses string.length.
        bytes: f.content.length,
      })),
      warnings: output.warnings.map((w) => w.message),
    }
  })

  return {
    composition: composition.name,
    version: composition.version,
    generated_at: clock().toISOString(),
    targets,
  }
}
