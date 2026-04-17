/**
 * Verb names and instance types for NOMARK Intents v0.4
 *
 * The canonical English labels are the wire format. Semantic IDs (0x01..0x1F)
 * are the language-neutral references. See registry for the full mapping.
 */

import type { Payload, Schema, VerbRef } from './common.js';

// ────────────────────────────────────────────────────────────────
// Verb name literal unions
// ────────────────────────────────────────────────────────────────

/** The 8 Data verbs. */
export type DataVerbName =
  | 'FETCH'
  | 'MAP'
  | 'FILTER'
  | 'REDUCE'
  | 'ENRICH'
  | 'PERSIST'
  | 'DELETE'
  | 'STREAM';

/** The 7 Flow verbs. */
export type FlowVerbName =
  | 'AWAIT'
  | 'BRANCH'
  | 'SPLIT'
  | 'MERGE'
  | 'GATE'
  | 'SIGNAL'
  | 'TERMINATE';

/** The 3 Resilience verbs. */
export type ResilienceVerbName = 'RETRY' | 'COMPENSATE' | 'ERROR';

/** The 1 Trust verb. */
export type TrustVerbName = 'VALIDATE';

/** The 1 Notification verb. */
export type NotificationVerbName = 'EMIT';

/** The 6 Outcome verbs. */
export type OutcomeVerbName =
  | 'MONITOR'
  | 'DECIDE'
  | 'CONFIGURE'
  | 'EXPLORE'
  | 'AUTHOR'
  | 'ONBOARD';

/** The 3 Present verbs. */
export type PresentVerbName = 'DISPLAY' | 'COLLECT' | 'ARRANGE';

/** The 2 Respond verbs. */
export type RespondVerbName = 'STATUS' | 'GUIDE';

/** The 20 computation verbs. */
export type ComputationVerbName =
  | DataVerbName
  | FlowVerbName
  | ResilienceVerbName
  | TrustVerbName
  | NotificationVerbName;

/** The 11 surface verbs. */
export type SurfaceVerbName =
  | OutcomeVerbName
  | PresentVerbName
  | RespondVerbName;

/** All 31 primitive verbs, plus the grammar verb COMPOSE. */
export type VerbName = ComputationVerbName | SurfaceVerbName | 'COMPOSE';

/** Category labels used by the registry. */
export type VerbCategory =
  | 'data'
  | 'flow'
  | 'resilience'
  | 'trust'
  | 'notification'
  | 'outcome'
  | 'present'
  | 'respond'
  | 'grammar';

// ────────────────────────────────────────────────────────────────
// VerbInstance — what appears in a COMPOSE body
// ────────────────────────────────────────────────────────────────

/**
 * A single verb invocation within a composition.
 *
 * `id` is the local name used for references (`VerbRef`).
 * `verb` is the canonical name.
 * `params` are the arguments matching the verb's type signature.
 * `entity` optionally binds the verb to an entity declared in the
 *   composition's EntityMap (required for multi-entity saga semantics).
 * `next` hints at control flow — resolvers derive the DAG from BRANCH/SPLIT/MERGE,
 *   so `next` is only needed for linear chains without explicit flow verbs.
 */
export interface VerbInstance<V extends VerbName = VerbName, P = Payload> {
  readonly id: string;
  readonly verb: V;
  readonly params: P;
  readonly entity?: string;
  readonly next?: string | readonly string[] | null;
}
