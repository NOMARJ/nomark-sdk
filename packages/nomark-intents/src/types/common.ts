/**
 * Common types for NOMARK Intents v0.4
 *
 * These are the shared primitive types referenced by verb signatures
 * throughout the specification. They are intentionally schema-opaque
 * where possible — resolvers interpret, the spec does not mandate
 * concrete representations.
 */

// ────────────────────────────────────────────────────────────────
// Primitive aliases
// ────────────────────────────────────────────────────────────────

/** Any structured payload flowing between verbs. */
export type Payload = Record<string, unknown>;

/** Opaque expression string. Resolver interprets the syntax. */
export type Expression = string;

/** Semver string — "1.0.0", "2.3.1-beta.1", etc. */
export type SemVer = string;

/** ISO 8601 timestamp. */
export type ISO8601 = string;

/** Reference to another verb instance within a composition. */
export type VerbRef = string;

/** Reference to a data output (by verb id or dotted path). */
export type DataRef = string;

/** Reference to another surface composition. */
export type ViewRef = string;

/** Reference to a rule or ruleset definition. */
export type RuleRef = string;

/** Authentication handle resolved by the resolver, not the spec. */
export type AuthRef = string;

// ────────────────────────────────────────────────────────────────
// Schema
// ────────────────────────────────────────────────────────────────

/**
 * Schema may be JSONSchema, a TypeSpec handle, or any resolver-specific
 * specification. Left intentionally loose at the spec layer.
 */
export type Schema =
  | { readonly $ref: string }
  | { readonly type: string; readonly [k: string]: unknown }
  | Record<string, unknown>;

/** A ruleset is a named collection of validation rules. */
export type RuleSet = { readonly $ref: string } | Record<string, unknown>;

// ────────────────────────────────────────────────────────────────
// Duration
// ────────────────────────────────────────────────────────────────

export type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd';

export interface Duration {
  readonly value: number;
  readonly unit: DurationUnit;
}

// ────────────────────────────────────────────────────────────────
// Execution & receipts
// ────────────────────────────────────────────────────────────────

export type ExecutionStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface ExecutionRef {
  readonly id: string;
  readonly status: ExecutionStatus;
}

export interface Receipt {
  readonly id: string;
  readonly timestamp: ISO8601;
  readonly sink: string;
  readonly reversible: boolean;
}

// ────────────────────────────────────────────────────────────────
// Actors & systems
// ────────────────────────────────────────────────────────────────

export interface ActorSpec {
  readonly type: 'user' | 'role' | 'group';
  readonly id: string;
}

export interface SystemSpec {
  readonly type: 'service' | 'workflow' | 'agent';
  readonly id: string;
}

export interface SignalSpec {
  readonly name: string;
  readonly schema?: Schema;
}

// ────────────────────────────────────────────────────────────────
// Retry & error routing
// ────────────────────────────────────────────────────────────────

export interface RetryPolicy {
  readonly max: number;
  readonly backoff: 'linear' | 'exponential';
  readonly delay: Duration;
  readonly jitter?: boolean;
}

export type ErrorAction = 'reject' | 'flag' | 'route';

export interface ErrorRoute {
  readonly action: ErrorAction;
  readonly target?: VerbRef;
  readonly metadata?: Payload;
}

export type ErrorTypeKind =
  | 'timeout'
  | 'validation'
  | 'system'
  | 'network'
  | 'custom';

export interface ErrorType {
  readonly type: ErrorTypeKind;
  readonly code?: string;
}

// ────────────────────────────────────────────────────────────────
// Event / source / sink specs
// ────────────────────────────────────────────────────────────────

export type EventKind =
  | 'cron'
  | 'webhook'
  | 'queue'
  | 'file'
  | 'db_change'
  | 'signal';

export interface EventSpec {
  readonly type: EventKind;
  readonly config: Record<string, unknown>;
}

export type SourceKind = 'http' | 'sql' | 'file' | 'queue' | 'api' | 'grpc';

export interface SourceSpec {
  readonly type: SourceKind;
  readonly config: Record<string, unknown>;
}

export type SinkKind = 'sql' | 'api' | 'file' | 'queue' | 'kv' | 's3';

export interface SinkSpec {
  readonly type: SinkKind;
  readonly config: Record<string, unknown>;
}

export type EmitKind =
  | 'webhook'
  | 'queue'
  | 'email'
  | 'slack'
  | 'log'
  | 'pubsub';

export interface EmitSpec {
  readonly type: EmitKind;
  readonly config: Record<string, unknown>;
}

/** Generic target spec for DELETE and similar. */
export interface TargetSpec {
  readonly type: string;
  readonly id?: string;
  readonly config?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────
// Branch conditions
// ────────────────────────────────────────────────────────────────

export interface Condition {
  readonly test: Expression;
  readonly then: VerbRef;
}

// ────────────────────────────────────────────────────────────────
// Decision (returned by GATE)
// ────────────────────────────────────────────────────────────────

export interface Decision {
  readonly chosen: string;
  readonly actor: ActorSpec;
  readonly timestamp: ISO8601;
  readonly rationale?: string;
}

// ────────────────────────────────────────────────────────────────
// Surface common types
// ────────────────────────────────────────────────────────────────

export type Density = 'compact' | 'comfortable' | 'spacious';
export type Priority = 'primary' | 'secondary' | 'tertiary';
export type Emphasis = 'hero' | 'standard' | 'subdued';

export type DisplayType =
  | 'metric'
  | 'chart'
  | 'table'
  | 'list'
  | 'card'
  | 'detail'
  | 'text'
  | 'image'
  | 'map';

export type CollectType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'toggle'
  | 'date'
  | 'file'
  | 'rich_text';

export type ArrangeType =
  | 'stack'
  | 'grid'
  | 'sidebar'
  | 'tabs'
  | 'split'
  | 'overlay'
  | 'sequence';

export type StatusType =
  | 'loading'
  | 'empty'
  | 'error'
  | 'success'
  | 'info'
  | 'warning';

export type GuideType =
  | 'alert'
  | 'hint'
  | 'breadcrumb'
  | 'next_action'
  | 'tooltip'
  | 'banner';

export type InteractionType =
  | 'click'
  | 'hover'
  | 'swipe'
  | 'drag'
  | 'select'
  | 'expand'
  | 'collapse';

export type AlertSeverity = 'info' | 'warn' | 'critical';

export type DismissPolicy = 'auto' | 'manual' | Duration;

export type RefreshPolicy = Duration | 'realtime' | 'on_demand';

export type ProgressType = 'linear' | 'flexible';

export type SaveMode = 'create' | 'edit';

// ────────────────────────────────────────────────────────────────
// Parameter spec (for CONFIGURE, AUTHOR)
// ────────────────────────────────────────────────────────────────

export interface ParamConstraints {
  readonly min?: number;
  readonly max?: number;
  readonly options?: readonly string[];
  readonly pattern?: string;
}

export interface ParamSpec {
  readonly key: string;
  readonly type: string;
  readonly default?: unknown;
  readonly constraints?: ParamConstraints;
  readonly description: string;
}

// ────────────────────────────────────────────────────────────────
// Brand marker — every verb instance carries this at the type level
// so COMPOSE can distinguish spec objects from arbitrary records.
// ────────────────────────────────────────────────────────────────

export const VERB_BRAND: unique symbol = Symbol.for('nomark.intents.verb');
export type VerbBrand = { readonly [VERB_BRAND]: true };
