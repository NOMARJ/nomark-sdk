import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { resolve as resolveComposition } from '../../src/resolvers/index.js'
import { FIXTURE_COMPOSITION } from './__fixtures__/composition.js'
import { FIXTURE_SURFACE_COMPOSITION } from './__fixtures__/surface-composition.js'
import type { Composition } from '../../src/resolvers/core/ir.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = path.join(__dirname, '__fixtures__', 'expected')

export const COMPUTE_LABELS = [
  'typescript',
  'python',
  'rust',
  'sql-postgres',
  'sql-sqlite',
  'sql-mysql',
] as const

export const SURFACE_LABELS = ['react', 'vue', 'svelte'] as const

export const FIXTURE_LABELS = [...COMPUTE_LABELS, ...SURFACE_LABELS] as const

export type FixtureLabel = (typeof FIXTURE_LABELS)[number]
export type ComputeLabel = (typeof COMPUTE_LABELS)[number]
export type SurfaceLabel = (typeof SURFACE_LABELS)[number]

export type FixtureFile = {
  name: string
  content: string
  bytes: number
}

export async function loadFixture(label: FixtureLabel): Promise<FixtureFile[]> {
  const dir = path.join(FIXTURE_ROOT, label)
  const entries = await readdir(dir)
  const files = await Promise.all(
    entries.map(async (name) => {
      const buf = await readFile(path.join(dir, name))
      return { name, content: buf.toString('utf8'), bytes: buf.byteLength }
    }),
  )
  return files.sort((a, b) => a.name.localeCompare(b.name))
}

function compositionFor(label: FixtureLabel): Composition {
  const surfaceLabels: readonly string[] = SURFACE_LABELS
  return surfaceLabels.includes(label) ? FIXTURE_SURFACE_COMPOSITION : FIXTURE_COMPOSITION
}

export function testBackend(label: FixtureLabel): void {
  it(`${label} backend matches fixture`, async () => {
    const expected = await loadFixture(label)
    const output = resolveComposition(compositionFor(label), label)

    expect(output.label).toBe(label)
    expect(output.files.map((f) => path.basename(f.path)).sort()).toEqual(
      expected.map((e) => e.name),
    )

    for (const e of expected) {
      const match = output.files.find((f) => path.basename(f.path) === e.name)
      if (!match) throw new Error(`missing file ${e.name} in ${label} output`)
      expect(match.content).toBe(e.content)
    }
  })
}
