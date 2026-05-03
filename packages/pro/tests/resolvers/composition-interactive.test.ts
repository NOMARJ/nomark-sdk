import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolve as resolveComposition } from '../../src/resolvers/index.js'
import { resolveAll } from '../../src/resolvers/manifest.js'
import { FIXTURE_INTERACTIVE_COMPOSITION } from './__fixtures__/composition-interactive.js'
import { SURFACE_LABELS } from './harness.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = path.join(__dirname, '__fixtures__', 'expected-interactive')

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

describe('W6 interactive fixture (DECIDE/CONFIGURE/EXPLORE/AUTHOR/ONBOARD/COLLECT)', () => {
  for (const label of SURFACE_LABELS) {
    it(`${label} backend matches admin_console fixture`, async () => {
      const expected = await loadFixture(label)
      const output = resolveComposition(FIXTURE_INTERACTIVE_COMPOSITION, label)

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

  it('all 3 surface backends emit no warnings on the interactive fixture', () => {
    const manifest = resolveAll(FIXTURE_INTERACTIVE_COMPOSITION, ['react', 'vue', 'svelte'])
    for (const target of manifest.targets) {
      expect(target.warnings).toEqual([])
    }
  })

  it('produces three target entries for resolveAll(interactive, [react, vue, svelte])', () => {
    const manifest = resolveAll(FIXTURE_INTERACTIVE_COMPOSITION, ['react', 'vue', 'svelte'])
    expect(manifest.targets).toHaveLength(3)
    expect(manifest.targets.map((t) => t.label)).toEqual(['react', 'vue', 'svelte'])
    expect(manifest.targets[0]?.files[0]?.path).toBe('react/Dashboard.tsx')
    expect(manifest.targets[1]?.files[0]?.path).toBe('vue/Dashboard.vue')
    expect(manifest.targets[2]?.files[0]?.path).toBe('svelte/Dashboard.svelte')
  })
})
