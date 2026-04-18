import { describe, expect, it } from 'vitest'
import { FIXTURE_COMPOSITION } from './__fixtures__/composition.js'
import { FIXTURE_SURFACE_COMPOSITION } from './__fixtures__/surface-composition.js'
import { isSurfaceVerb } from '../../src/resolvers/core/ir.js'

describe('FIXTURE_COMPOSITION', () => {
  it('identifies as daily_fund_flow_etl v0.4.0', () => {
    expect(FIXTURE_COMPOSITION.name).toBe('daily_fund_flow_etl')
    expect(FIXTURE_COMPOSITION.version).toBe('0.4.0')
  })

  it('carries the description that appears in every fixture header', () => {
    expect(FIXTURE_COMPOSITION.description).toBe(
      'Pull daily fund flow rows from an HTTP source, validate, normalize, aggregate per fund, upsert into Postgres, then notify on completion.',
    )
  })

  it('declares 7 verbs in the observed execution order', () => {
    expect(FIXTURE_COMPOSITION.verbs.map((v) => v.id)).toEqual([
      'fetch_rows',
      'validate_rows',
      'normalize_region',
      'drop_zero',
      'aggregate_daily',
      'upsert_daily',
      'notify_done',
    ])
  })

  it('uses the 7 verb classes actually rendered in the fixtures', () => {
    expect(FIXTURE_COMPOSITION.verbs.map((v) => v.verb)).toEqual([
      'FETCH',
      'VALIDATE',
      'MAP',
      'FILTER',
      'REDUCE',
      'PERSIST',
      'EMIT',
    ])
  })

  it('MAP and REDUCE carry both raw and structured forms (spec §3.1)', () => {
    const map = FIXTURE_COMPOSITION.verbs.find((v) => v.id === 'normalize_region')
    expect(map?.params).toHaveProperty('expression')
    expect(map?.params).toHaveProperty('project')

    const reduce = FIXTURE_COMPOSITION.verbs.find((v) => v.id === 'aggregate_daily')
    expect(reduce?.params).toHaveProperty('expression')
    expect(reduce?.params).toHaveProperty('group_by')
    expect(reduce?.params).toHaveProperty('agg')
  })
})

describe('FIXTURE_SURFACE_COMPOSITION', () => {
  it('identifies as fund_flow_dashboard v0.4.0', () => {
    expect(FIXTURE_SURFACE_COMPOSITION.name).toBe('fund_flow_dashboard')
    expect(FIXTURE_SURFACE_COMPOSITION.version).toBe('0.4.0')
  })

  it('carries the description that appears in the fixture header', () => {
    expect(FIXTURE_SURFACE_COMPOSITION.description).toBe(
      'Read-model dashboard for fund flow monitoring.',
    )
  })

  it('declares 6 verbs in the observed rendering order', () => {
    expect(FIXTURE_SURFACE_COMPOSITION.verbs.map((v) => v.id)).toEqual([
      'outcome',
      'layout',
      'metric_aum',
      'chart_flows',
      'loading',
      'anomaly_hint',
    ])
  })

  it('uses the 5 surface verb classes actually rendered (SUR-000 scope)', () => {
    expect(FIXTURE_SURFACE_COMPOSITION.verbs.map((v) => v.verb)).toEqual([
      'MONITOR',
      'ARRANGE',
      'DISPLAY',
      'DISPLAY',
      'STATUS',
      'GUIDE',
    ])
  })

  it('contains zero compute verbs (hermetic surface contract)', () => {
    for (const verb of FIXTURE_SURFACE_COMPOSITION.verbs) {
      expect(isSurfaceVerb(verb.verb)).toBe(true)
    }
  })

  it('carries the params every REACT_STYLE data-attribute depends on', () => {
    const monitor = FIXTURE_SURFACE_COMPOSITION.verbs.find((v) => v.id === 'outcome')
    expect(monitor?.params).toMatchObject({
      subject: 'fund flows',
      data: ['aum_total', 'flow_by_fund'],
      refresh: { value: 5, unit: 'm' },
    })

    const arrange = FIXTURE_SURFACE_COMPOSITION.verbs.find((v) => v.id === 'layout')
    expect(arrange?.params).toMatchObject({
      type: 'grid',
      density: 'compact',
      children: ['metric_aum', 'chart_flows'],
    })

    const metric = FIXTURE_SURFACE_COMPOSITION.verbs.find((v) => v.id === 'metric_aum')
    expect(metric?.params).toMatchObject({
      type: 'metric',
      emphasis: 'hero',
      label: 'Total AUM',
    })

    const status = FIXTURE_SURFACE_COMPOSITION.verbs.find((v) => v.id === 'loading')
    expect(status?.params).toMatchObject({
      type: 'loading',
      message: 'Fetching fund flows...',
    })

    const guide = FIXTURE_SURFACE_COMPOSITION.verbs.find((v) => v.id === 'anomaly_hint')
    expect(guide?.params).toMatchObject({
      type: 'alert',
      priority: 'primary',
    })
  })
})
