/**
 * Outcome verb parameter types (verbs 21–26).
 *
 * MONITOR, DECIDE, CONFIGURE, EXPLORE, AUTHOR, ONBOARD.
 *
 * Outcome verbs describe WHY an interface exists — the actor's goal.
 * They imply a constellation of lower-level Present/Respond verbs
 * which the surface resolver materialises.
 */

import type {
  AlertSeverity,
  DataRef,
  Duration,
  Expression,
  ParamSpec,
  ProgressType,
  RefreshPolicy,
  RuleRef,
  SaveMode,
  Schema,
  ViewRef,
  VerbRef,
} from './common.js';

// ── MONITOR ─────────────────────────────────────────────────────
export interface MonitorAlert {
  readonly condition: Expression;
  readonly severity: AlertSeverity;
  readonly action?: ViewRef;
}

export interface MonitorParams {
  readonly subject: string;
  readonly data: readonly DataRef[];
  readonly refresh: RefreshPolicy;
  readonly alerts?: readonly MonitorAlert[];
  readonly drill_down?: ViewRef;
}

// ── DECIDE ──────────────────────────────────────────────────────
export interface DecideOption {
  readonly id: string;
  readonly label: string;
  readonly data?: DataRef;
  readonly score?: number;
  readonly recommended?: boolean;
}

export interface DecideParams {
  readonly question: string;
  readonly options: readonly DecideOption[];
  readonly evidence: readonly DataRef[];
  readonly constraints?: readonly RuleRef[];
  readonly deadline?: Duration;
  readonly default?: string;
}

// ── CONFIGURE ───────────────────────────────────────────────────
export interface ConfigureParams {
  readonly subject: string;
  readonly parameters: readonly ParamSpec[];
  readonly preview?: DataRef;
  readonly apply: VerbRef;
}

// ── EXPLORE ─────────────────────────────────────────────────────
export interface ExploreSearch {
  readonly fields: readonly string[];
  readonly fulltext?: boolean;
}

export interface ExploreFilter {
  readonly facets: readonly string[];
}

export interface ExploreSort {
  readonly fields: readonly string[];
  readonly default: string;
}

export interface ExploreParams {
  readonly space: string;
  readonly entry: DataRef | ViewRef;
  readonly search?: ExploreSearch;
  readonly filter?: ExploreFilter;
  readonly drill_down?: ViewRef;
  readonly sort?: ExploreSort;
}

// ── AUTHOR ──────────────────────────────────────────────────────
export interface AuthorParams {
  readonly subject: string;
  readonly schema: Schema;
  readonly mode: SaveMode;
  readonly template?: DataRef;
  readonly save: VerbRef;
  readonly autosave?: Duration;
}

// ── ONBOARD ─────────────────────────────────────────────────────
export interface OnboardStep {
  readonly id: string;
  readonly title: string;
  readonly content: DataRef;
  readonly required?: boolean;
}

export interface OnboardParams {
  readonly subject: string;
  readonly steps: readonly OnboardStep[];
  readonly progress: ProgressType;
  readonly completion: VerbRef;
}
