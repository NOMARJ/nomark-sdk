/**
 * Resilience, Trust, and Notification verb parameter types (verbs 16–20).
 *
 * RETRY, COMPENSATE, ERROR, VALIDATE, EMIT.
 */

import type {
  EmitSpec,
  ErrorRoute,
  ErrorType,
  Payload,
  Receipt,
  RetryPolicy,
  RuleSet,
  Schema,
  VerbRef,
} from './common.js';

// ── RETRY ───────────────────────────────────────────────────────
export interface RetryParams {
  readonly target: VerbRef;
  readonly policy: RetryPolicy;
  readonly on_exhausted: ErrorRoute;
}

// ── COMPENSATE ──────────────────────────────────────────────────
export interface CompensateParams {
  /**
   * Receipt reference — either an inline Receipt object,
   * or a string DataRef like ":persist_step.receipt".
   */
  readonly receipt: Receipt | string;
  readonly action: VerbRef;
  readonly idempotent?: boolean;
  readonly reason?: string;
}

// ── ERROR ───────────────────────────────────────────────────────
export interface ErrorParams {
  readonly source: VerbRef;
  readonly catch: readonly ErrorType[];
  readonly handler: VerbRef;
  readonly propagate?: boolean;
}

// ── VALIDATE ────────────────────────────────────────────────────
export interface ValidateParams {
  readonly input?: string | Payload;
  readonly rules: Schema | RuleSet;
  readonly on_fail: ErrorRoute;
}

// ── EMIT ────────────────────────────────────────────────────────
export interface EmitParams {
  readonly payload?: string | Payload;
  readonly target: EmitSpec;
  /** Literal `true` — EMIT is always fire-and-forget by spec. */
  readonly fire_and_forget?: true;
}
