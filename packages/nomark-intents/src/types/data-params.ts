/**
 * Data verb parameter types (verbs 1–8).
 *
 * FETCH, MAP, FILTER, REDUCE, ENRICH, PERSIST, DELETE, STREAM.
 */

import type {
  AuthRef,
  Duration,
  Expression,
  Payload,
  RetryPolicy,
  SinkSpec,
  SourceSpec,
  TargetSpec,
  VerbRef,
} from './common.js';

// ── FETCH ───────────────────────────────────────────────────────
export interface FetchParams {
  readonly source: SourceSpec;
  readonly auth?: AuthRef;
  readonly retry?: RetryPolicy;
  readonly cache?: { readonly ttl: Duration; readonly key: string };
}

// ── MAP ─────────────────────────────────────────────────────────
export interface MapParams {
  /** DataRef or inline payload the expression operates on. */
  readonly input?: string | Payload;
  readonly expression: Expression;
}

// ── FILTER ──────────────────────────────────────────────────────
export interface FilterParams {
  readonly input?: string | ReadonlyArray<Payload>;
  readonly predicate: Expression;
}

// ── REDUCE ──────────────────────────────────────────────────────
export interface ReduceParams {
  readonly input?: string | ReadonlyArray<Payload>;
  readonly expression: Expression;
  readonly initial?: unknown;
}

// ── ENRICH ──────────────────────────────────────────────────────
export interface EnrichParams {
  readonly input?: string | Payload;
  readonly source: SourceSpec;
  readonly join_on: Expression;
  readonly fields: readonly string[];
}

// ── PERSIST ─────────────────────────────────────────────────────
export type PersistMode = 'upsert' | 'insert' | 'replace';

export interface PersistParams {
  readonly input?: string | Payload;
  readonly sink: SinkSpec;
  readonly mode: PersistMode;
  readonly idempotency_key?: string;
}

// ── DELETE ──────────────────────────────────────────────────────
export type DeleteMode = 'soft' | 'hard';

export interface DeleteParams {
  readonly target: TargetSpec;
  readonly sink: SinkSpec;
  readonly mode: DeleteMode;
}

// ── STREAM ──────────────────────────────────────────────────────
export type Backpressure = 'drop' | 'buffer' | 'block';

export interface StreamParams {
  readonly source: SourceSpec;
  readonly each: VerbRef;
  readonly buffer?: { readonly size: number; readonly flush: Duration };
  readonly until?: Expression;
  readonly backpressure?: Backpressure;
}
