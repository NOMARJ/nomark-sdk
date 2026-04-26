/**
 * W5 fixture A — BRANCH + TERMINATE flow verbs.
 *
 * 5-verb composition exercising conditional routing and pipeline abort:
 *   fetch_data (FETCH)
 *     → validate (VALIDATE)
 *     → route_by_status (BRANCH) — { ok → map_record, fail → abort }
 *         map_record (MAP) → persist_data (PERSIST) [success terminal]
 *         abort (TERMINATE)                          [failure terminal]
 *
 * Branch-targets `map_record` and `abort` are not in the linear backbone;
 * they are reachable only via the BRANCH verb. The success subchain
 * (map_record → persist_data) is wired explicitly.
 */

import type { Composition } from '../../../src/resolvers/core/ir.js'

const VALIDATE_RULES = [{ field: 'status', check: 'required' }]

const MAP_PROJECTION = {
  id: 'id',
  status: 'status',
  amount: 'amount',
}

export const FIXTURE_FLOW_ROUTING_COMPOSITION: Composition = {
  name: 'flow_routing',
  version: '0.4.0',
  description: 'Conditional pipeline: validate, route on status, map+persist on success or terminate on failure.',
  verbs: [
    {
      id: 'fetch_data',
      verb: 'FETCH',
      params: {
        source: { type: 'http', config: { url: 'https://api.example.com/records' } },
      },
    },
    {
      id: 'validate',
      verb: 'VALIDATE',
      params: { rules: VALIDATE_RULES, on_fail: { action: 'reject' } },
    },
    {
      id: 'route_by_status',
      verb: 'BRANCH',
      params: {
        conditions: [{ when: 'status == "ok"', then: 'map_record' }],
        default: 'abort',
      },
    },
    {
      id: 'map_record',
      verb: 'MAP',
      params: {
        expression: '{ id: id, status: status, amount: amount }',
        project: MAP_PROJECTION,
      },
      next: 'persist_data',
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
      id: 'abort',
      verb: 'TERMINATE',
      params: { reason: 'validation rejected', status: 'failed', cleanup: [] },
    },
  ],
}
