import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { resolve as resolveComposition } from '../../src/resolvers/index.js'
import { FIXTURE_COMPOSITION } from './__fixtures__/composition.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = path.join(__dirname, '__fixtures__', 'expected')

export const FIXTURE_LABELS = [
  'typescript',
  'python',
  'rust',
  'sql-postgres',
  'sql-sqlite',
  'sql-mysql',
] as const

export type FixtureLabel = (typeof FIXTURE_LABELS)[number]

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

export function testBackend(label: FixtureLabel): void {
  it(`${label} backend matches fixture`, async () => {
    const expected = await loadFixture(label)
    const output = resolveComposition(FIXTURE_COMPOSITION, label)

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
