import { describe, expect, it } from 'vitest'
import { resolve, availableTargets } from '../../src/resolvers/index.js'
import { FIXTURE_COMPOSITION } from './__fixtures__/composition.js'
import { FIXTURE_SURFACE_COMPOSITION } from './__fixtures__/surface-composition.js'

describe('resolve() target dispatch', () => {
  it('accepts a bare string label (compute)', () => {
    const out = resolve(FIXTURE_COMPOSITION, 'typescript')
    expect(out.label).toBe('typescript')
    expect(out.files.length).toBeGreaterThan(0)
  })

  it('accepts a bare string label (surface)', () => {
    const out = resolve(FIXTURE_SURFACE_COMPOSITION, 'react')
    expect(out.label).toBe('react')
    expect(out.files.length).toBeGreaterThan(0)
  })

  it('accepts a compute-only TargetTag', () => {
    const out = resolve(FIXTURE_COMPOSITION, { compute: 'python' })
    expect(out.label).toBe('python')
  })

  it('accepts a surface-only TargetTag', () => {
    const out = resolve(FIXTURE_SURFACE_COMPOSITION, { surface: 'react' })
    expect(out.label).toBe('react')
  })

  it('throws on an ambiguous TargetTag (both compute and surface set)', () => {
    expect(() =>
      resolve(FIXTURE_COMPOSITION, { compute: 'typescript', surface: 'react' }),
    ).toThrow(/ambiguous target — pass a specific label string/)
  })

  it('throws on an empty TargetTag (neither set)', () => {
    expect(() => resolve(FIXTURE_COMPOSITION, {})).toThrow(
      /target has no compute or surface tag/,
    )
  })

  it('throws on an unknown label with the known-targets list in the message', () => {
    expect(() => resolve(FIXTURE_COMPOSITION, 'cobol')).toThrow(
      /no backend registered for target 'cobol'.*Known:/,
    )
  })

  // Intentional pin: this snapshot breaks the day someone adds an 8th backend,
  // forcing an explicit decision + README + SOLUTION.md update. Relax to
  // `toContain(...)` only if the registry becomes dynamically-populated.
  it('exposes all 7 registered backends via availableTargets()', () => {
    expect(availableTargets()).toEqual([
      'python',
      'react',
      'rust',
      'sql-mysql',
      'sql-postgres',
      'sql-sqlite',
      'typescript',
    ])
  })
})
