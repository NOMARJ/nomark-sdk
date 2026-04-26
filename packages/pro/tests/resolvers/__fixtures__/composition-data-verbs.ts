/**
 * DRAFT — W2 wave-1 fixture (ENRICH / DELETE / STREAM). Awaiting owner gate-2 ack.
 *
 * Hermetic fixture exercising the three data-category compute verbs not yet
 * handled by any backend: ENRICH, DELETE, STREAM. Anchored by FETCH at the
 * head and EMIT at the tail so the resulting byte-exact files contain real
 * preamble/postamble dispatcher entries (no isolated-verb edge cases).
 *
 * Domain stays in fund-flow ETL territory for symmetry with the existing
 * `composition.ts` fixture, but the pipeline is independent — purges legacy
 * rows after enriching them with retention metadata. Resolver tests pin
 * byte-exact across all 6 compute backends per the standard contract.
 *
 * Frozen on owner ack — see commit message for gate-2 reference.
 */

import type { Composition } from '../../../src/resolvers/core/ir.js'

const ENRICH_EXTRAS = {
  archived_at: 'now()',
  retention_days: 30,
}

export const FIXTURE_DATA_VERBS_COMPOSITION: Composition = {
  name: 'archive_compaction',
  version: '0.4.0',
  description:
    'Stream legacy fund-flow rows from Postgres, enrich each with retention metadata, delete archived rows from the source table, then notify on completion.',
  verbs: [
    {
      id: 'stream_legacy',
      verb: 'STREAM',
      params: {
        source: {
          type: 'sql',
          config: { table: 'fund_flow_legacy' },
        },
        batch_size: 100,
      },
    },
    {
      id: 'enrich_retention',
      verb: 'ENRICH',
      params: {
        with: ENRICH_EXTRAS,
      },
    },
    {
      id: 'purge_archived',
      verb: 'DELETE',
      params: {
        sink: {
          type: 'sql',
          config: { table: 'fund_flow_legacy' },
        },
        predicate: 'archived_at < now() - interval(retention_days)',
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
