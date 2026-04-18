/**
 * Reverse-engineered fixture composition for resolver byte-equality tests.
 *
 * Reconstructed from the committed output fixtures under `expected/` by
 * inspecting TS, Python, Rust, and SQL-postgres renderings of each verb.
 * Resolver tests import FIXTURE_COMPOSITION from here, not from
 * `@nomark/intents/examples`. The canonical SDK example is free to evolve —
 * resolver tests stay hermetic.
 *
 * MAP and REDUCE carry BOTH raw (`expression`) and structured forms per spec
 * §3.1 dual authoring. Procedural backends (TS/Python/Rust) emit the raw
 * expression verbatim; SQL backends use the structured form to generate views
 * with multi-aggregate SELECT clauses.
 *
 * SQL outputs like `SELECT * FROM "src"` and `INSERT INTO "fund_flow_daily"
 * ("*unknown_columns*") VALUES ($1)` are intentional — they fall out of an
 * opaque FETCH.source (HTTP, untranslatable to SQL) and a no-column-list
 * PERSIST.sink. Preserve as-is.
 */

import type { Composition } from '../../../src/resolvers/core/ir.js'

const VALIDATE_RULES = [
  { field: 'fund_id', check: 'required' },
  { field: 'flow_usd', check: 'numeric' },
  { field: 'trade_date', check: 'required' },
]

const MAP_PROJECTION = {
  fund_id: 'fund_id',
  trade_date: 'trade_date',
  flow_usd: 'flow_usd',
  region: 'region',
}

export const FIXTURE_COMPOSITION: Composition = {
  name: 'daily_fund_flow_etl',
  version: '0.4.0',
  description:
    'Pull daily fund flow rows from an HTTP source, validate, normalize, aggregate per fund, upsert into Postgres, then notify on completion.',
  verbs: [
    {
      id: 'fetch_rows',
      verb: 'FETCH',
      params: {
        source: {
          type: 'http',
          config: { url: 'https://api.example.com/fund-flows/daily' },
        },
      },
    },
    {
      id: 'validate_rows',
      verb: 'VALIDATE',
      params: {
        rules: VALIDATE_RULES,
        on_fail: { action: 'reject' },
      },
    },
    {
      id: 'normalize_region',
      verb: 'MAP',
      params: {
        expression:
          '{ fund_id: fund_id, trade_date: trade_date, flow_usd: flow_usd, region: region }',
        project: MAP_PROJECTION,
      },
    },
    {
      id: 'drop_zero',
      verb: 'FILTER',
      params: { predicate: 'flow_usd != 0' },
    },
    {
      id: 'aggregate_daily',
      verb: 'REDUCE',
      params: {
        expression: 'group_by(fund_id,trade_date).sum(flow_usd)',
        group_by: ['fund_id', 'trade_date'],
        agg: {
          total_flow_usd: 'sum(flow_usd)',
          row_count: 'count(*)',
        },
      },
    },
    {
      id: 'upsert_daily',
      verb: 'PERSIST',
      params: {
        sink: {
          type: 'sql',
          config: { table: 'fund_flow_daily' },
        },
        mode: 'insert',
      },
    },
    {
      id: 'notify_done',
      verb: 'EMIT',
      params: {
        target: {
          type: 'slack',
          config: { channel: '#data-ops' },
        },
      },
    },
  ],
}
