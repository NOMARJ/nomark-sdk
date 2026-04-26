import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolve as resolveComposition } from '../../src/resolvers/index.js'
import { resolveAll } from '../../src/resolvers/manifest.js'
import { FIXTURE_RESILIENCE_COMPOSITION } from './__fixtures__/composition-resilience-verbs.js'
import { COMPUTE_LABELS } from './harness.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = path.join(__dirname, '__fixtures__', 'expected-resilience-verbs')

async function loadResilienceFixture(label: string): Promise<{ name: string; content: string }[]> {
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

describe('W4 resilience-verbs fixture (RETRY / COMPENSATE / ERROR)', () => {
  for (const label of COMPUTE_LABELS) {
    it(`${label} backend matches resilient_etl fixture`, async () => {
      const expected = await loadResilienceFixture(label)
      const output = resolveComposition(FIXTURE_RESILIENCE_COMPOSITION, label)

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

  it('procedural backends emit no warnings on the resilience fixture', () => {
    const manifest = resolveAll(FIXTURE_RESILIENCE_COMPOSITION, [
      'typescript',
      'python',
      'rust',
    ])
    for (const target of manifest.targets) {
      expect(target.warnings).toEqual([])
    }
  })

  it('SQL backends emit fixed-spec warnings for RETRY/ERROR/COMPENSATE', () => {
    const manifest = resolveAll(FIXTURE_RESILIENCE_COMPOSITION, [
      'sql-postgres',
      'sql-sqlite',
      'sql-mysql',
    ])
    for (const target of manifest.targets) {
      expect(target.warnings).toEqual([
        'verb RETRY (fetch_with_retry) cannot retry in SQL compute — host required',
        'verb ERROR (safe_validate) requires error routing in host runtime',
        'verb COMPENSATE (rollback_persist) requires runtime receipt tracking — host required',
      ])
    }
  })
})
