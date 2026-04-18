import { describe, expect, it } from 'vitest'
import {
  resolve, resolveAll, registerResolver, availableTargets, BaseResolver,
  type Composition, type TargetTag, type ResolveTarget,
  type Verb, type VerbName, type ComputeVerb, type SurfaceVerb,
  type EntityDecl, type EntityRole,
  type VerbHandler, type ResolverContext,
  type ResolverOutput, type ResolverFile, type ResolverWarning,
  type Manifest, type ManifestFileEntry, type ManifestTargetEntry, type ResolveAllOptions,
  mapExpr, reduceExpr, partitionVerbs, isSurfaceVerb,
} from '../src/index.js'
describe('public API', () => {
  it('exposes 7 registered backends including react', () => {
    expect(availableTargets()).toContain('react')
    expect(availableTargets()).toHaveLength(7)
  })
  it('has resolve, resolveAll, registerResolver, BaseResolver as callable values', () => {
    expect(typeof resolve).toBe('function')
    expect(typeof resolveAll).toBe('function')
    expect(typeof registerResolver).toBe('function')
    expect(typeof BaseResolver).toBe('function')
    expect(typeof mapExpr).toBe('function')
    expect(typeof reduceExpr).toBe('function')
    expect(typeof partitionVerbs).toBe('function')
    expect(typeof isSurfaceVerb).toBe('function')
  })
})
