import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolve as resolveComposition } from '../../src/resolvers/index.js'
import { resolveAll } from '../../src/resolvers/manifest.js'
import { FIXTURE_FLOW_ROUTING_COMPOSITION } from './__fixtures__/composition-flow-routing.js'
import { COMPUTE_LABELS } from './harness.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = path.join(__dirname, '__fixtures__', 'expected-flow-routing')

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

describe('W5 flow-routing fixture (BRANCH + TERMINATE)', () => {
  for (const label of COMPUTE_LABELS) {
    it(`${label} backend matches flow_routing fixture`, async () => {
      const expected = await loadFixture(label)
      const output = resolveComposition(FIXTURE_FLOW_ROUTING_COMPOSITION, label)

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

  it('procedural backends emit no warnings on flow_routing', () => {
    const manifest = resolveAll(FIXTURE_FLOW_ROUTING_COMPOSITION, [
      'typescript',
      'python',
      'rust',
    ])
    for (const target of manifest.targets) {
      expect(target.warnings).toEqual([])
    }
  })

  it('SQL backends emit fixed-spec warnings for BRANCH + TERMINATE', () => {
    const manifest = resolveAll(FIXTURE_FLOW_ROUTING_COMPOSITION, [
      'sql-postgres',
      'sql-sqlite',
      'sql-mysql',
    ])
    for (const target of manifest.targets) {
      expect(target.warnings).toEqual([
        'verb BRANCH (route_by_status) is a flow-control verb — host runtime required',
        'verb TERMINATE (abort) is a flow-control verb — host runtime required',
      ])
    }
  })
})
