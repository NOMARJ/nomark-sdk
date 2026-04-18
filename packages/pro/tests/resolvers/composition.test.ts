import { describe, expect, it } from 'vitest'
import { FIXTURE_COMPOSITION } from './__fixtures__/composition.js'

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
