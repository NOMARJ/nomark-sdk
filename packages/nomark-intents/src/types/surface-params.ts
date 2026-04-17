/**
 * Present verb parameter types (verbs 27–29) and
 * Respond verb parameter types (verbs 30–31).
 *
 * DISPLAY, COLLECT, ARRANGE, STATUS, GUIDE.
 */

import type {
  ArrangeType,
  CollectType,
  DataRef,
  Density,
  DismissPolicy,
  DisplayType,
  Emphasis,
  Expression,
  GuideType,
  InteractionType,
  Priority,
  Schema,
  StatusType,
  VerbRef,
} from './common.js';

// Forward-declared structural types for recursive ARRANGE.
// `PresentSpec` and `RespondSpec` are verb IDs in practice (VerbRef),
// because ARRANGE.children references other verb instances by id.
export type PresentSpec = VerbRef;
export type RespondSpec = VerbRef;

// ── DISPLAY ─────────────────────────────────────────────────────
export interface DisplayInteraction {
  readonly on: InteractionType;
  readonly action: VerbRef;
}

export interface DisplayParams {
  readonly type: DisplayType;
  readonly data: DataRef;
  readonly emphasis?: Emphasis;
  readonly interact?: readonly DisplayInteraction[];
  readonly label?: string;
}

// ── COLLECT ─────────────────────────────────────────────────────
export interface CollectParams {
  readonly type: CollectType;
  readonly field: string;
  readonly label: string;
  readonly required?: boolean;
  readonly default?: unknown;
  readonly validation?: Schema;
  readonly placeholder?: string;
}

// ── ARRANGE ─────────────────────────────────────────────────────
export interface ResponsiveRearrange {
  readonly breakpoint: string;
  readonly rearrange: ArrangeType;
}

export interface ArrangeParams {
  readonly type: ArrangeType;
  readonly children: readonly PresentSpec[];
  readonly density?: Density;
  readonly responsive?: readonly ResponsiveRearrange[];
}

// ── STATUS ──────────────────────────────────────────────────────
export interface StatusParams {
  readonly type: StatusType;
  readonly message?: string;
  readonly detail?: DataRef;
  readonly action?: VerbRef;
  readonly dismiss?: DismissPolicy;
}

// ── GUIDE ───────────────────────────────────────────────────────
export interface GuideParams {
  readonly type: GuideType;
  readonly message: string;
  readonly condition?: Expression;
  readonly action?: VerbRef;
  readonly priority?: Priority;
  readonly dismiss?: DismissPolicy;
}
