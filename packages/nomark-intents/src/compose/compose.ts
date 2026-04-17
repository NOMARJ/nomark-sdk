/**
 * COMPOSE — the grammar verb.
 *
 * Folds a collection of verb instances into a single callable ComposedUnit.
 * Performs structural validation at construction time so malformed
 * compositions fail fast rather than at resolver time.
 */

import type { Schema, SemVer } from '../types/common.js';
import type { AnyVerb } from '../types/params-map.js';
import type {
  ComposedUnit,
  CompensationMap,
  CostBudget,
  EntityMap,
  ErrorPolicy,
  TargetHint,
} from './composed-unit.js';

export interface ComposeInput {
  readonly name: string;
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
 * Construct a ComposedUnit.
 *
 * Structural checks performed:
 *   - name, version, schemas present
 *   - at least one verb
 *   - no duplicate verb ids
 *   - `next` / BRANCH / SPLIT / MERGE references point to real verb ids
 *   - compensation map keys and values reference real verb ids
 *   - error_policy overrides reference real verb ids
 *   - entity references in verbs point to declared entities
 *
 * Deeper semantic checks (cycles, type propagation, etc.) live in the
 * validator module.
 */
export function compose(input: ComposeInput): ComposedUnit {
  if (!input.name || typeof input.name !== 'string') {
    throw new TypeError('compose: name must be a non-empty string');
  }
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(input.version)) {
    throw new TypeError(
      `compose(${input.name}): version must be semver (got "${input.version}")`,
    );
  }
  if (!input.input_schema) {
    throw new TypeError(`compose(${input.name}): input_schema is required`);
  }
  if (!input.output_schema) {
    throw new TypeError(`compose(${input.name}): output_schema is required`);
  }
  if (!Array.isArray(input.verbs) || input.verbs.length === 0) {
    throw new TypeError(
      `compose(${input.name}): verbs must be a non-empty array`,
    );
  }

  // Duplicate ids
  const ids = new Set<string>();
  for (const v of input.verbs) {
    if (!v.id) {
      throw new TypeError(`compose(${input.name}): verb missing id`);
    }
    if (ids.has(v.id)) {
      throw new TypeError(
        `compose(${input.name}): duplicate verb id "${v.id}"`,
      );
    }
    ids.add(v.id);
  }

  // Entity references
  const entityNames = input.entities ? new Set(Object.keys(input.entities)) : null;
  if (entityNames) {
    for (const v of input.verbs) {
      if (v.entity !== undefined && !entityNames.has(v.entity)) {
        throw new TypeError(
          `compose(${input.name}): verb "${v.id}" references unknown entity "${v.entity}"`,
        );
      }
    }
  }

  // next / BRANCH / SPLIT / MERGE references
  for (const v of input.verbs) {
    // top-level `next`
    if (v.next) {
      const refs = Array.isArray(v.next) ? v.next : [v.next];
      for (const ref of refs) {
        if (ref !== null && !ids.has(ref)) {
          throw new TypeError(
            `compose(${input.name}): verb "${v.id}" has next="${ref}" but no such verb exists`,
          );
        }
      }
    }

    // verb-specific references
    collectVerbRefs(v).forEach((ref) => {
      if (!ids.has(ref)) {
        throw new TypeError(
          `compose(${input.name}): verb "${v.id}" references unknown verb "${ref}"`,
        );
      }
    });
  }

  // Compensation map
  if (input.compensations) {
    for (const [target, reverser] of Object.entries(input.compensations)) {
      if (!ids.has(target)) {
        throw new TypeError(
          `compose(${input.name}): compensation key "${target}" does not reference a declared verb`,
        );
      }
      if (!ids.has(reverser)) {
        throw new TypeError(
          `compose(${input.name}): compensation reverser "${reverser}" does not reference a declared verb`,
        );
      }
    }
  }

  // Error policy overrides
  if (input.error_policy?.overrides) {
    for (const override of input.error_policy.overrides) {
      if (!ids.has(override.verb_id)) {
        throw new TypeError(
          `compose(${input.name}): error_policy override for unknown verb "${override.verb_id}"`,
        );
      }
    }
  }

  const unit: ComposedUnit = {
    compose: input.name,
    version: input.version,
    ...(input.description !== undefined ? { description: input.description } : {}),
    input_schema: input.input_schema,
    output_schema: input.output_schema,
    ...(input.entities !== undefined ? { entities: input.entities } : {}),
    verbs: input.verbs,
    ...(input.error_policy !== undefined ? { error_policy: input.error_policy } : {}),
    ...(input.compensations !== undefined ? { compensations: input.compensations } : {}),
    ...(input.budget !== undefined ? { budget: input.budget } : {}),
    ...(input.target !== undefined ? { target: input.target } : {}),
  };

  return unit;
}

/**
 * Collect all VerbRef strings from a verb's params.
 * Used for integrity checking inside compose().
 */
function collectVerbRefs(v: AnyVerb): readonly string[] {
  const refs: string[] = [];
  const p = v.params as Record<string, unknown>;

  switch (v.verb) {
    case 'BRANCH': {
      const conditions = (p.conditions as Array<{ then?: string }> | undefined) ?? [];
      for (const c of conditions) if (c.then) refs.push(c.then);
      if (typeof p.default === 'string') refs.push(p.default);
      break;
    }
    case 'SPLIT': {
      const paths = (p.paths as Array<string | { path?: string }> | undefined) ?? [];
      for (const x of paths) {
        if (typeof x === 'string') refs.push(x);
        else if (x && typeof x === 'object' && typeof x.path === 'string')
          refs.push(x.path);
      }
      break;
    }
    case 'MERGE': {
      const inputs = (p.inputs as string[] | undefined) ?? [];
      refs.push(...inputs);
      break;
    }
    case 'AWAIT':
    case 'SIGNAL': {
      if (typeof p.fallback === 'string') refs.push(p.fallback);
      break;
    }
    case 'GATE': {
      if (typeof p.on_timeout === 'string') refs.push(p.on_timeout);
      break;
    }
    case 'TERMINATE': {
      const cleanup = (p.cleanup as string[] | undefined) ?? [];
      refs.push(...cleanup);
      break;
    }
    case 'RETRY': {
      if (typeof p.target === 'string') refs.push(p.target);
      const onExhausted = p.on_exhausted as { target?: string } | undefined;
      if (onExhausted?.target) refs.push(onExhausted.target);
      break;
    }
    case 'COMPENSATE': {
      if (typeof p.action === 'string') refs.push(p.action);
      break;
    }
    case 'ERROR': {
      if (typeof p.source === 'string') refs.push(p.source);
      if (typeof p.handler === 'string') refs.push(p.handler);
      break;
    }
    case 'VALIDATE': {
      const onFail = p.on_fail as { target?: string } | undefined;
      if (onFail?.target) refs.push(onFail.target);
      break;
    }
    case 'STREAM': {
      if (typeof p.each === 'string') refs.push(p.each);
      break;
    }
    case 'CONFIGURE': {
      if (typeof p.apply === 'string') refs.push(p.apply);
      break;
    }
    case 'AUTHOR': {
      if (typeof p.save === 'string') refs.push(p.save);
      break;
    }
    case 'ONBOARD': {
      if (typeof p.completion === 'string') refs.push(p.completion);
      break;
    }
    case 'DISPLAY': {
      const interact = (p.interact as Array<{ action?: string }> | undefined) ?? [];
      for (const i of interact) if (i.action) refs.push(i.action);
      break;
    }
    case 'ARRANGE': {
      const children = (p.children as string[] | undefined) ?? [];
      refs.push(...children);
      break;
    }
    case 'STATUS':
    case 'GUIDE': {
      if (typeof p.action === 'string') refs.push(p.action);
      break;
    }
    case 'MONITOR': {
      const alerts = (p.alerts as Array<{ action?: string }> | undefined) ?? [];
      for (const a of alerts) if (a.action) refs.push(a.action);
      break;
    }
    default:
      // Other verbs have no embedded VerbRefs we need to check here.
      break;
  }

  return refs;
}

// Re-export the internal so the validator can reuse it for deeper checks.
export const __collectVerbRefs = collectVerbRefs;
