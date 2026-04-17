/**
 * Verb builders.
 *
 * One exported function per verb. Each returns a strongly-typed
 * `VerbInstance` ready to drop into a composition body.
 *
 * Usage:
 *   import { FETCH, MAP, PERSIST } from '@nomark/intents/verbs';
 *
 *   FETCH('extract', { source: { type: 'sql', config: { query: 'SELECT * FROM t' } } })
 */

import type {
  AnyVerb,
  ParamsOf,
  TypedVerb,
  VerbName,
} from '../types/params-map.js';

// ────────────────────────────────────────────────────────────────
// Core builder — generic over verb name
// ────────────────────────────────────────────────────────────────

export interface BuilderOptions {
  readonly entity?: string;
  readonly next?: string | readonly string[] | null;
}

function makeVerb<const V extends VerbName>(verb: V) {
  return function build(
    id: string,
    params: ParamsOf<V>,
    options?: BuilderOptions,
  ): TypedVerb<V> {
    if (!id || typeof id !== 'string') {
      throw new TypeError(
        `${verb}: 'id' must be a non-empty string (received ${String(id)})`,
      );
    }
    if (params === null || typeof params !== 'object') {
      throw new TypeError(
        `${verb}: 'params' must be an object (received ${String(params)})`,
      );
    }
    const inst: TypedVerb<V> = {
      id,
      verb,
      params,
      ...(options?.entity !== undefined ? { entity: options.entity } : {}),
      ...(options?.next !== undefined ? { next: options.next } : {}),
    };
    return inst;
  };
}

// ────────────────────────────────────────────────────────────────
// Data verbs
// ────────────────────────────────────────────────────────────────

/** FETCH — acquire data from external source. Read-only, idempotent. */
export const FETCH = makeVerb('FETCH');

/** MAP — reshape a single record. 1:1, pure. */
export const MAP = makeVerb('MAP');

/** FILTER — reduce collection by predicate. n:≤n, pure. */
export const FILTER = makeVerb('FILTER');

/** REDUCE — aggregate collection to single value. n:1. */
export const REDUCE = makeVerb('REDUCE');

/** ENRICH — augment record with external data. 1:1 with side effect. */
export const ENRICH = makeVerb('ENRICH');

/** PERSIST — write to sink. Returns receipt for compensation. */
export const PERSIST = makeVerb('PERSIST');

/** DELETE — remove from sink. Soft or hard. */
export const DELETE_ = makeVerb('DELETE');
export { DELETE_ as DELETE };

/** STREAM — continuous receive and per-item processing. Open channel. */
export const STREAM = makeVerb('STREAM');

// ────────────────────────────────────────────────────────────────
// Flow verbs
// ────────────────────────────────────────────────────────────────

/** AWAIT — block until event, time, or signal. Fires once. */
export const AWAIT = makeVerb('AWAIT');

/** BRANCH — exclusive conditional path selection. */
export const BRANCH = makeVerb('BRANCH');

/** SPLIT — fan-out to parallel executions. */
export const SPLIT = makeVerb('SPLIT');

/** MERGE — fan-in from parallel executions. */
export const MERGE = makeVerb('MERGE');

/** GATE — pause for human decision. Slow, non-deterministic. */
export const GATE = makeVerb('GATE');

/** SIGNAL — await system/agent response. Fast, programmatic. */
export const SIGNAL = makeVerb('SIGNAL');

/** TERMINATE — kill entire execution. All branches cancelled. */
export const TERMINATE = makeVerb('TERMINATE');

// ────────────────────────────────────────────────────────────────
// Resilience verbs
// ────────────────────────────────────────────────────────────────

/** RETRY — decorator, wraps any verb with retry logic. */
export const RETRY = makeVerb('RETRY');

/** COMPENSATE — reverse a completed operation using its receipt. */
export const COMPENSATE = makeVerb('COMPENSATE');

/** ERROR — decorator, catches failure and routes to handler. */
export const ERROR = makeVerb('ERROR');

// ────────────────────────────────────────────────────────────────
// Trust verb
// ────────────────────────────────────────────────────────────────

/** VALIDATE — assert schema/rules. The trust boundary. */
export const VALIDATE = makeVerb('VALIDATE');

// ────────────────────────────────────────────────────────────────
// Notification verb
// ────────────────────────────────────────────────────────────────

/** EMIT — fire-and-forget message. At-least-once when queue-backed. */
export const EMIT = makeVerb('EMIT');

// ────────────────────────────────────────────────────────────────
// Outcome verbs
// ────────────────────────────────────────────────────────────────

/** MONITOR — observe state, detect change, maintain awareness. */
export const MONITOR = makeVerb('MONITOR');

/** DECIDE — evaluate options, commit to one. */
export const DECIDE = makeVerb('DECIDE');

/** CONFIGURE — set parameters governing system behaviour. */
export const CONFIGURE = makeVerb('CONFIGURE');

/** EXPLORE — navigate, search, discover, drill into detail. */
export const EXPLORE = makeVerb('EXPLORE');

/** AUTHOR — create or edit structured content. */
export const AUTHOR = makeVerb('AUTHOR');

/** ONBOARD — learn a system, build mental model. */
export const ONBOARD = makeVerb('ONBOARD');

// ────────────────────────────────────────────────────────────────
// Present verbs
// ────────────────────────────────────────────────────────────────

/** DISPLAY — render data for actor consumption. */
export const DISPLAY = makeVerb('DISPLAY');

/** COLLECT — gather input from actor. */
export const COLLECT = makeVerb('COLLECT');

/** ARRANGE — organise surfaces in space or sequence. */
export const ARRANGE = makeVerb('ARRANGE');

// ────────────────────────────────────────────────────────────────
// Respond verbs
// ────────────────────────────────────────────────────────────────

/** STATUS — communicate system state to actor. */
export const STATUS = makeVerb('STATUS');

/** GUIDE — direct attention or suggest next action. */
export const GUIDE = makeVerb('GUIDE');

// ────────────────────────────────────────────────────────────────
// Bag of builders, for dynamic construction
// ────────────────────────────────────────────────────────────────

/**
 * Build a verb by name at runtime. Prefer the named builders for type safety;
 * this escape hatch exists for code generation and LLM-driven authoring.
 */
export function verb<V extends VerbName>(
  name: V,
  id: string,
  params: ParamsOf<V>,
  options?: BuilderOptions,
): TypedVerb<V> {
  return makeVerb(name)(id, params, options);
}

/** Type guard: is this value a VerbInstance? */
export function isVerb(value: unknown): value is AnyVerb {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.verb === 'string' &&
    typeof v.params === 'object' &&
    v.params !== null
  );
}
