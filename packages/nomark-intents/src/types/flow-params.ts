/**
 * Flow verb parameter types (verbs 9–15).
 *
 * AWAIT, BRANCH, SPLIT, MERGE, GATE, SIGNAL, TERMINATE.
 */

import type {
  ActorSpec,
  Condition,
  Duration,
  EventSpec,
  Expression,
  Payload,
  SignalSpec,
  SystemSpec,
  VerbRef,
} from './common.js';

// ── AWAIT ───────────────────────────────────────────────────────
export interface AwaitParams {
  readonly on: EventSpec;
  readonly timeout?: Duration;
  readonly fallback?: VerbRef;
}

// ── BRANCH ──────────────────────────────────────────────────────
export interface BranchParams {
  readonly input?: string | Payload;
  readonly conditions: readonly Condition[];
  readonly default: VerbRef;
}

// ── SPLIT ───────────────────────────────────────────────────────
export type SplitStrategy = 'all' | 'match';

export interface SplitConditionalPath {
  readonly condition: Expression;
  readonly path: VerbRef;
}

export interface SplitParams {
  readonly input?: string | Payload;
  readonly strategy: SplitStrategy;
  readonly paths: readonly VerbRef[] | readonly SplitConditionalPath[];
}

// ── MERGE ───────────────────────────────────────────────────────
export type MergeStrategyName = 'all' | 'any';

/**
 * Merge strategy is either the literal "all" / "any",
 * or the object form `{ n_of: number }` representing `n_of(int)`.
 */
export type MergeStrategy =
  | MergeStrategyName
  | { readonly n_of: number };

export interface MergeParams {
  readonly inputs: readonly VerbRef[];
  readonly strategy: MergeStrategy;
  readonly timeout?: Duration;
  readonly reducer?: Expression;
}

// ── GATE ────────────────────────────────────────────────────────
export interface GateParams {
  readonly input?: string | Payload;
  readonly assignee: ActorSpec;
  readonly prompt: string;
  readonly options?: readonly string[];
  readonly timeout?: Duration;
  readonly on_timeout?: VerbRef;
}

// ── SIGNAL ──────────────────────────────────────────────────────
export interface SignalParams {
  readonly source: SystemSpec;
  readonly await: SignalSpec;
  readonly timeout?: Duration;
  readonly fallback?: VerbRef;
}

// ── TERMINATE ───────────────────────────────────────────────────
export type TerminateStatus = 'success' | 'failure' | 'cancelled';

export interface TerminateParams {
  readonly reason: string;
  readonly status: TerminateStatus;
  readonly cleanup?: readonly VerbRef[];
}
