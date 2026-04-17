/**
 * Composition structure types.
 *
 * COMPOSE folds verbs into a callable unit. A ComposedUnit has:
 *   - identity (name, version)
 *   - schema boundaries (input_schema, output_schema)
 *   - optional entity graph for multi-entity sagas
 *   - verb body
 *   - error policy
 *   - compensation map for rollback
 *   - cost budget for runtime enforcement
 *   - target hints for resolvers
 */

import type {
  ErrorRoute,
  Schema,
  SemVer,
  VerbRef,
} from '../types/common.js';
import type { AnyVerb } from '../types/params-map.js';
import type { VerbName } from '../types/verb-names.js';

// ────────────────────────────────────────────────────────────────
// Entity graph (Section 5.2)
// ────────────────────────────────────────────────────────────────

export type EntityRole = 'primary' | 'affected';

export interface EntityDefinition {
  readonly schema: Schema;
  readonly role: EntityRole;
}

export type EntityMap = Record<string, EntityDefinition>;

// ────────────────────────────────────────────────────────────────
// Error policy (Section 5.3)
// ────────────────────────────────────────────────────────────────

export interface ErrorPolicyOverride {
  readonly verb_id: string;
  readonly handler: ErrorRoute;
}

export interface ErrorPolicy {
  readonly default: ErrorRoute;
  readonly overrides?: readonly ErrorPolicyOverride[];
}

// ────────────────────────────────────────────────────────────────
// Compensation map (Section 5.4)
// ────────────────────────────────────────────────────────────────

/**
 * Maps verb id (one that produces a Receipt) to the VerbRef that reverses it.
 * Traversed in reverse order at COMPENSATE time.
 */
export type CompensationMap = Record<string, VerbRef>;

// ────────────────────────────────────────────────────────────────
// Cost budget (Section 5.5)
// ────────────────────────────────────────────────────────────────

export interface CostBudget {
  readonly max_verbs?: number;
  readonly max_parallel?: number;
  readonly max_external_calls?: number;
  readonly timeout?: { readonly value: number; readonly unit: 's' | 'm' | 'h' };
}

// ────────────────────────────────────────────────────────────────
// Target hints (Section 8.1)
// ────────────────────────────────────────────────────────────────

export type ComputeTarget =
  | 'python'
  | 'typescript'
  | 'sql'
  | 'rust'
  | string;

export type SurfaceTarget =
  | 'react'
  | 'swiftui'
  | 'html'
  | 'api'
  | 'cli'
  | 'slack'
  | 'pdf'
  | 'voice'
  | string;

export interface TargetHint {
  readonly compute?: ComputeTarget;
  readonly surface?: SurfaceTarget;
  /** Optional path or handle to a DESIGN.md tokens file. */
  readonly design?: string;
}

// ────────────────────────────────────────────────────────────────
// ComposedUnit — the spec-level output of COMPOSE
// ────────────────────────────────────────────────────────────────

/**
 * The canonical serialisable form of a composition.
 * Emitted to JSON for resolver consumption and spec interchange.
 */
export interface ComposedUnit {
  readonly compose: string;
  readonly version: SemVer;
  readonly description?: string;
  readonly input_schema: Schema;
  readonly output_schema: Schema;
  readonly entities?: EntityMap;
  readonly verbs: readonly AnyVerb[];
  readonly error_policy?: ErrorPolicy;
  readonly compensations?: CompensationMap;
  readonly budget?: CostBudget;
  readonly target?: TargetHint;
}

/**
 * When a ComposedUnit is used as a VerbRef inside a larger composition,
 * it becomes a synthetic verb — the grammar rule "compositions are verbs".
 */
export interface ComposedVerbRef {
  readonly kind: 'COMPOSE';
  readonly name: string;
  readonly version: SemVer;
}

/** Type guard. */
export function isComposedUnit(value: unknown): value is ComposedUnit {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.compose === 'string' &&
    typeof v.version === 'string' &&
    typeof v.input_schema === 'object' &&
    typeof v.output_schema === 'object' &&
    Array.isArray(v.verbs)
  );
}
