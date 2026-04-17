/**
 * Lifecycle layer (spec §6).
 *
 * A LIFECYCLE binds a domain entity to a state machine, a set of
 * named operations (ComposedUnits), and the transitions between states.
 *
 * The state machine is the truth. Operations are named paths through it.
 * Mirror pairs emerge when the domain has them — they are not imposed.
 */

import type {
  Expression,
  RuleSet,
  Schema,
  SemVer,
} from '../types/common.js';
import type { ComposedUnit } from '../compose/composed-unit.js';

// ────────────────────────────────────────────────────────────────
// Transitions
// ────────────────────────────────────────────────────────────────

export interface Transition {
  readonly from: string;
  /** Operation name (key in operations map). */
  readonly via: string;
  readonly to: string;
  readonly guard?: Expression;
}

// ────────────────────────────────────────────────────────────────
// Lifecycle definition
// ────────────────────────────────────────────────────────────────

export interface LifecycleDefinition {
  readonly name: string;
  readonly domain: string;
  readonly version: SemVer;
  readonly entity: Schema;
  readonly states: readonly string[];
  readonly operations: Readonly<Record<string, ComposedUnit>>;
  readonly transitions: readonly Transition[];
  readonly invariants?: RuleSet;
}

// ────────────────────────────────────────────────────────────────
// Builder
// ────────────────────────────────────────────────────────────────

export interface LifecycleInput extends Omit<LifecycleDefinition, 'version'> {
  readonly version: SemVer;
}

/**
 * Construct a lifecycle with structural validation:
 *   - All transition `from` / `to` states are declared
 *   - Every `via` references a known operation
 *   - At least one state exists
 *   - Operations cover every `via`
 */
export function LIFECYCLE(input: LifecycleInput): LifecycleDefinition {
  if (!input.name) throw new TypeError('LIFECYCLE: name is required');
  if (!input.domain) throw new TypeError('LIFECYCLE: domain is required');
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(input.version)) {
    throw new TypeError(
      `LIFECYCLE(${input.name}): version must be semver`,
    );
  }
  if (!input.states || input.states.length === 0) {
    throw new TypeError(
      `LIFECYCLE(${input.name}): states must be a non-empty array`,
    );
  }

  const stateSet = new Set(input.states);
  const opNames = new Set(Object.keys(input.operations));

  for (const t of input.transitions) {
    if (!stateSet.has(t.from)) {
      throw new TypeError(
        `LIFECYCLE(${input.name}): transition references unknown from-state "${t.from}"`,
      );
    }
    if (!stateSet.has(t.to)) {
      throw new TypeError(
        `LIFECYCLE(${input.name}): transition references unknown to-state "${t.to}"`,
      );
    }
    if (!opNames.has(t.via)) {
      throw new TypeError(
        `LIFECYCLE(${input.name}): transition via "${t.via}" is not a declared operation`,
      );
    }
  }

  return {
    name: input.name,
    domain: input.domain,
    version: input.version,
    entity: input.entity,
    states: input.states,
    operations: input.operations,
    transitions: input.transitions,
    ...(input.invariants !== undefined ? { invariants: input.invariants } : {}),
  };
}

// ────────────────────────────────────────────────────────────────
// Pattern helpers (spec §6.3)
// ────────────────────────────────────────────────────────────────

export type LifecyclePattern = 'mirror' | 'progression' | 'branching' | 'mixed';

/**
 * Classify a lifecycle by the shape of its transition graph.
 *
 *   - mirror:      exactly one forward edge and one reverse edge between
 *                  each connected state pair (BUY ↔ SELL)
 *   - progression: linear chain with no reverse edges (ADMIT → TREAT → DISCHARGE)
 *   - branching:   a state has outgoing edges to ≥2 distinct successor states,
 *                  neither of which reverses (SUBSCRIBE → UPGRADE | DOWNGRADE | CHURN)
 *   - mixed:       combinations of the above
 */
export function classifyLifecycle(lc: LifecycleDefinition): LifecyclePattern {
  const edges: Record<string, Set<string>> = {};
  const reverse: Record<string, Set<string>> = {};
  for (const t of lc.transitions) {
    (edges[t.from] ??= new Set()).add(t.to);
    (reverse[t.to] ??= new Set()).add(t.from);
  }

  let hasMirror = false;
  let hasBranching = false;
  let hasProgression = false;

  // Branching: any source state has ≥2 distinct destinations.
  for (const outs of Object.values(edges)) {
    if (outs.size >= 2) hasBranching = true;
  }

  for (const t of lc.transitions) {
    const isMirror =
      (reverse[t.from]?.has(t.to) ?? false) &&
      (edges[t.to]?.has(t.from) ?? false);
    if (isMirror) {
      hasMirror = true;
      continue;
    }
    // Progression: a non-mirror edge whose source is *not* branching.
    const sourceFanOut = edges[t.from]?.size ?? 0;
    if (sourceFanOut <= 1) hasProgression = true;
  }

  const kinds = [hasMirror, hasProgression, hasBranching].filter(Boolean).length;
  if (kinds >= 2) return 'mixed';
  if (hasMirror) return 'mirror';
  if (hasBranching) return 'branching';
  return 'progression';
}

/**
 * Return the list of states reachable from `start` via declared transitions.
 */
export function reachableStates(
  lc: LifecycleDefinition,
  start: string,
): readonly string[] {
  if (!lc.states.includes(start)) return [];
  const visited = new Set<string>([start]);
  const queue: string[] = [start];
  while (queue.length) {
    const s = queue.shift()!;
    for (const t of lc.transitions) {
      if (t.from === s && !visited.has(t.to)) {
        visited.add(t.to);
        queue.push(t.to);
      }
    }
  }
  return [...visited];
}

/**
 * Return the operation name (if any) that transitions from `from` to `to`.
 */
export function operationFor(
  lc: LifecycleDefinition,
  from: string,
  to: string,
): string | null {
  const t = lc.transitions.find((x) => x.from === from && x.to === to);
  return t?.via ?? null;
}
