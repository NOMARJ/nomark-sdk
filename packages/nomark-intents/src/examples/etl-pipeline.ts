/**
 * Worked example 7.1 — Daily Fund Flow ETL.
 *
 * Pure computation. Cron trigger, fetch, validate, clean, enrich,
 * aggregate, persist, notify. Mirrors the JSON from the spec
 * but authored as type-safe TypeScript.
 */

import {
  AWAIT,
  EMIT,
  ENRICH,
  FETCH,
  FILTER,
  PERSIST,
  REDUCE,
  VALIDATE,
  compose,
} from '../index.js';

export const DAILY_FUND_FLOW_ETL = compose({
  name: 'DAILY_FUND_FLOW_ETL',
  version: '1.0.0',
  description: 'Cron-triggered ingestion of raw fund flows, normalised and aggregated into fund_flows_daily.',
  input_schema: {
    type: 'object',
    properties: { date: { format: 'date' } },
  },
  output_schema: { $ref: '#/schemas/etl_receipt' },
  verbs: [
    AWAIT('trigger', {
      on: { type: 'cron', config: { expression: '0 6 * * *' } },
    }),
    FETCH('extract', {
      source: {
        type: 'sql',
        config: { query: 'SELECT * FROM raw_flows WHERE date = :date' },
      },
    }),
    VALIDATE('validate', {
      rules: { $ref: '#/rules/flow_schema' },
      on_fail: { action: 'route', target: 'alert' },
    }),
    FILTER('clean', {
      predicate: 'row.amount != null',
    }),
    ENRICH('enrich', {
      source: {
        type: 'api',
        config: { url: '/fund-metadata/:fund_id' },
      },
      join_on: 'fund_id',
      fields: ['fund_name', 'category'],
    }),
    REDUCE('aggregate', {
      expression: 'group_by(fund_id).sum(amount)',
    }),
    PERSIST('load', {
      sink: { type: 'sql', config: { table: 'fund_flows_daily' } },
      mode: 'upsert',
      idempotency_key: 'fund_id+date',
    }),
    EMIT('notify', {
      target: { type: 'slack', config: { channel: '#data-ops' } },
    }),
    EMIT('alert', {
      target: { type: 'email', config: { to: 'ops@example.com' } },
    }),
  ],
  error_policy: {
    default: { action: 'route', target: 'alert' },
  },
  compensations: {
    load: 'alert', // Receipt reversal is left to downstream reconciliation.
  },
  target: { compute: 'python' },
});
