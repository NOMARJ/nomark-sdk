/**
 * W4 fixture composition — RETRY / COMPENSATE / ERROR.
 *
 * Hermetic fixture exercising the three resilience-category compute verbs.
 * The IR shape uses inlined targets (`params.of: { verb, params }`) rather
 * than VerbRef-to-sibling — see W4_RESILIENCE_DESIGN §2 for rationale.
 *
 * Pipeline:
 *   - fetch_with_retry   (RETRY wrapping FETCH, exponential backoff)
 *   - safe_validate      (ERROR catching VALIDATE failures, routing to handler)
 *   - persist_data       (PERSIST — provides the receipt COMPENSATE consumes)
 *   - rollback_persist   (COMPENSATE reversing persist_data via DELETE)
 *
 * Resolver tests pin byte-exact across all 6 compute backends.
 */

import type { Composition } from '../../../src/resolvers/core/ir.js'

const VALIDATE_RULES = [
  { field: 'id', check: 'required' },
]

export const FIXTURE_RESILIENCE_COMPOSITION: Composition = {
  name: 'resilient_etl',
  version: '0.4.0',
  description:
    'ETL with retried fetch, error-handled validate, persisted records, and a compensating undo for the persist step.',
  verbs: [
    {
      id: 'fetch_with_retry',
      verb: 'RETRY',
      params: {
        of: {
          verb: 'FETCH',
          params: {
            source: {
              type: 'http',
              config: { url: 'https://api.example.com/records' },
            },
          },
        },
        policy: { max: 3, delay_ms: 1000, backoff: 'exponential', jitter: true },
      },
    },
    {
      id: 'safe_validate',
      verb: 'ERROR',
      params: {
        of: {
          verb: 'VALIDATE',
          params: { rules: VALIDATE_RULES, on_fail: { action: 'reject' } },
        },
        catch: ['ValidationError', 'ValueError'],
        handler: {
          verb: 'EMIT',
          params: {
            target: { type: 'slack', config: { channel: '#alerts' } },
          },
        },
      },
    },
    {
      id: 'persist_data',
      verb: 'PERSIST',
      params: {
        sink: { type: 'sql', config: { table: 'records' } },
        mode: 'insert',
      },
    },
    {
      id: 'rollback_persist',
      verb: 'COMPENSATE',
      params: {
        receipt_from: 'persist_data',
        reverse: {
          verb: 'DELETE',
          params: {
            sink: { type: 'sql', config: { table: 'records' } },
            predicate: 'id = $1',
          },
        },
        idempotent: true,
        reason: 'rollback failed pipeline',
      },
    },
  ],
}
