import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolve as resolveComposition } from '../../src/resolvers/index.js'
import { resolveAll } from '../../src/resolvers/manifest.js'
import { FIXTURE_DATA_VERBS_COMPOSITION } from './__fixtures__/composition-data-verbs.js'
import { COMPUTE_LABELS } from './harness.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = path.join(__dirname, '__fixtures__', 'expected-data-verbs')

async function loadDataVerbsFixture(label: string): Promise<{ name: string; content: string }[]> {
  const dir = path.join(FIXTURE_ROOT, label)
  const entries = await readdir(dir)
  const files = await Promise.all(
    entries.map(async (name) => {
      const buf = await readFile(path.join(dir, name))
      return { name, content: buf.toString('utf8') }
    }),
  )
  return files.sort((a, b) => a.name.localeCompare(b.name))
}

describe('W2 data-verbs fixture (ENRICH / DELETE / STREAM)', () => {
  for (const label of COMPUTE_LABELS) {
    it(`${label} backend matches archive_compaction fixture`, async () => {
      const expected = await loadDataVerbsFixture(label)
      const output = resolveComposition(FIXTURE_DATA_VERBS_COMPOSITION, label)

      expect(output.label).toBe(label)
      expect(
        output.files.map((f) => path.basename(f.path)).sort((a, b) => a.localeCompare(b)),
      ).toEqual(expected.map((e) => e.name))

      for (const e of expected) {
        const match = output.files.find((f) => path.basename(f.path) === e.name)
        if (!match) throw new Error(`missing file ${e.name} in ${label} output`)
        expect(match.content).toBe(e.content)
      }
    })
  }

  it('procedural backends emit no warnings on the data-verbs fixture', () => {
    const manifest = resolveAll(FIXTURE_DATA_VERBS_COMPOSITION, [
      'typescript',
      'python',
      'rust',
    ])
    for (const target of manifest.targets) {
      expect(target.warnings).toEqual([])
    }
  })

  it('SQL backends emit only the fixed-spec EMIT warning on the data-verbs fixture', () => {
    const manifest = resolveAll(FIXTURE_DATA_VERBS_COMPOSITION, [
      'sql-postgres',
      'sql-sqlite',
      'sql-mysql',
    ])
    for (const target of manifest.targets) {
      expect(target.warnings).toEqual([
        'verb EMIT (notify_done) cannot be expressed in SQL compute — add a host layer to drive this step',
      ])
    }
  })
})
