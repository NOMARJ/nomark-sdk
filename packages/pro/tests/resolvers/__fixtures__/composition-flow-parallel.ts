/**
 * W5 fixture B — SPLIT/MERGE/AWAIT/GATE/SIGNAL flow verbs.
 *
 * 8-verb composition exercising parallel fan-out and human/external gating:
 *   fetch_orders (FETCH)
 *     → fan_out (SPLIT) — { process_north, process_south, process_east }
 *     → fan_in (MERGE)  — concat results from fan_out branches
 *     → settle_wait (AWAIT) — block on settlement event w/ timeout fallback
 *     → human_review (GATE) — manual approve/reject decision
 *     → notify_external (SIGNAL) — webhook to payment gateway
 *
 * `process_north/south/east` are SPLIT children — reachable only via SPLIT,
 * not part of the linear backbone. fan_in's `from: 'fan_out'` reads the
 * branched results from ctx.values.
 */

import type { Composition } from '../../../src/resolvers/core/ir.js'

const REGION_MAP = (region: string) => ({
  expression: `{ id: id, region: '${region}', amount: amount }`,
  project: { id: 'id', region: `'${region}'`, amount: 'amount' },
})

export const FIXTURE_FLOW_PARALLEL_COMPOSITION: Composition = {
  name: 'flow_parallel',
  version: '0.4.0',
  description: 'Parallel fan-out by region, merge results, await settlement, gate on human review, signal external.',
  verbs: [
    {
      id: 'fetch_orders',
      verb: 'FETCH',
      params: {
        source: { type: 'http', config: { url: 'https://api.example.com/orders' } },
      },
    },
    {
      id: 'fan_out',
      verb: 'SPLIT',
      params: {
        strategy: 'parallel',
        targets: ['process_north', 'process_south', 'process_east'],
      },
    },
    {
      id: 'process_north',
      verb: 'MAP',
      params: REGION_MAP('north'),
    },
    {
      id: 'process_south',
      verb: 'MAP',
      params: REGION_MAP('south'),
    },
    {
      id: 'process_east',
      verb: 'MAP',
      params: REGION_MAP('east'),
    },
    {
      id: 'fan_in',
      verb: 'MERGE',
      params: {
        sources: ['process_north', 'process_south', 'process_east'],
        strategy: 'all',
        from: 'fan_out',
      },
    },
    {
      id: 'settle_wait',
      verb: 'AWAIT',
      params: {
        event: { topic: 'settlement.completed' },
        timeout_ms: 3600000,
      },
    },
    {
      id: 'human_review',
      verb: 'GATE',
      params: {
        actor: { role: 'compliance_officer' },
        prompt: 'Approve this batch?',
        options: ['approve', 'reject'],
        timeout_ms: 86400000,
      },
    },
    {
      id: 'notify_external',
      verb: 'SIGNAL',
      params: {
        system: 'payment-gateway',
        signal: { type: 'webhook', url: 'https://gateway.example.com/notify' },
        timeout_ms: 30000,
      },
    },
  ],
}
