import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveAll } from '../../src/resolvers/manifest.js'
import { FIXTURE_COMPOSITION } from './__fixtures__/composition.js'
import { FIXTURE_LABELS } from './harness.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_MANIFEST_PATH = path.join(
  __dirname,
  '__fixtures__',
  'expected',
  'manifest.json',
)

const FIXTURE_CLOCK = () => new Date('2026-04-16T20:59:12.079Z')
const FIXTURE_BASE = '/mnt/user-data/outputs'

describe('resolveAll', () => {
  it('produces a manifest byte-exact to the fixture when clock + basePath are pinned', async () => {
    const manifest = resolveAll(FIXTURE_COMPOSITION, [...FIXTURE_LABELS], {
      basePath: FIXTURE_BASE,
      clock: FIXTURE_CLOCK,
    })
    const expectedJson = await readFile(FIXTURE_MANIFEST_PATH, 'utf8')
    const expected = JSON.parse(expectedJson)
    expect(manifest).toEqual(expected)
  })

  it('emits the fixed-spec SQL EMIT warning for every SQL target', () => {
    const manifest = resolveAll(FIXTURE_COMPOSITION, [
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

  it('emits no warnings for procedural targets (typescript, python, rust)', () => {
    const manifest = resolveAll(FIXTURE_COMPOSITION, [
      'typescript',
      'python',
      'rust',
    ])
    for (const target of manifest.targets) {
      expect(target.warnings).toEqual([])
    }
  })

  it('omits the basePath when not supplied, producing relative paths', () => {
    const manifest = resolveAll(FIXTURE_COMPOSITION, ['typescript'], {
      clock: FIXTURE_CLOCK,
    })
    expect(manifest.targets[0]?.files[0]?.path).toBe(
      'typescript/daily_fund_flow_etl.ts',
    )
  })

  it('defaults generated_at to the current time when no clock is supplied', () => {
    const before = Date.now()
    const manifest = resolveAll(FIXTURE_COMPOSITION, ['typescript'])
    const generated = Date.parse(manifest.generated_at)
    const after = Date.now()
    expect(generated).toBeGreaterThanOrEqual(before)
    expect(generated).toBeLessThanOrEqual(after)
  })
})
