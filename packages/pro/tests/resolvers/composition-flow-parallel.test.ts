import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolve as resolveComposition } from '../../src/resolvers/index.js'
import { resolveAll } from '../../src/resolvers/manifest.js'
import { FIXTURE_FLOW_PARALLEL_COMPOSITION } from './__fixtures__/composition-flow-parallel.js'
import { COMPUTE_LABELS } from './harness.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = path.join(__dirname, '__fixtures__', 'expected-flow-parallel')

async function loadFixture(label: string): Promise<{ name: string; content: string }[]> {
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

describe('W5 flow-parallel fixture (SPLIT/MERGE/AWAIT/GATE/SIGNAL)', () => {
  for (const label of COMPUTE_LABELS) {
    it(`${label} backend matches flow_parallel fixture`, async () => {
      const expected = await loadFixture(label)
      const output = resolveComposition(FIXTURE_FLOW_PARALLEL_COMPOSITION, label)

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

  it('procedural backends emit no warnings on flow_parallel', () => {
    const manifest = resolveAll(FIXTURE_FLOW_PARALLEL_COMPOSITION, [
      'typescript',
      'python',
      'rust',
    ])
    for (const target of manifest.targets) {
      expect(target.warnings).toEqual([])
    }
  })

  it('SQL backends emit fixed-spec warnings for all 5 flow verbs', () => {
    const manifest = resolveAll(FIXTURE_FLOW_PARALLEL_COMPOSITION, [
      'sql-postgres',
      'sql-sqlite',
      'sql-mysql',
    ])
    for (const target of manifest.targets) {
      expect(target.warnings).toEqual([
        'verb SPLIT (fan_out) is a flow-control verb — host runtime required',
        'verb MERGE (fan_in) is a flow-control verb — host runtime required',
        'verb AWAIT (settle_wait) is a flow-control verb — host runtime required',
        'verb GATE (human_review) is a flow-control verb — host runtime required',
        'verb SIGNAL (notify_external) is a flow-control verb — host runtime required',
      ])
    }
  })
})
