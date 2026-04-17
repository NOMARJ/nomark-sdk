/**
 * Flatten compiler.
 *
 * Per spec §5.2 rule 7: "Flatten at compile. All nesting expands to
 * linear verb sequence at runtime."
 *
 * When a ComposedUnit appears as a VerbRef inside a larger composition,
 * its verbs are inlined with id-prefixing to prevent collisions.
 */

import type { ComposedUnit } from '../compose/composed-unit.js';
import type { AnyVerb } from '../types/params-map.js';

export interface FlattenOptions {
  /** Separator for prefixed ids. Default "." */
  readonly separator?: string;
  /** Registry of nested compositions by name. */
  readonly registry?: ReadonlyMap<string, ComposedUnit>;
}

/**
 * Flatten a composition, inlining any nested ComposedUnit references.
 *
 * The spec does not prescribe a nested-reference marker — in practice,
 * resolvers look for verb entries whose `verb === 'COMPOSE'` and whose
 * params carry a `name` pointing to a registered composition. This
 * function supports that convention.
 *
 * If no registry is provided or no COMPOSE verbs are present, the unit
 * is returned as-is after a no-op pass.
 */
export function flatten(
  unit: ComposedUnit,
  options: FlattenOptions = {},
): ComposedUnit {
  const sep = options.separator ?? '.';
  const registry = options.registry;

  const flattenedVerbs: AnyVerb[] = [];
  const seenNames = new Set<string>([unit.compose]);

  const visit = (
    u: ComposedUnit,
    prefix: string,
    depth: number,
  ): void => {
    if (depth > 32) {
      throw new Error(
        `flatten: excessive composition depth at "${u.compose}" (possible cycle in registry)`,
      );
    }
    for (const v of u.verbs) {
      if (v.verb === 'COMPOSE') {
        const nestedName = (v.params as { name?: string }).name;
        if (!nestedName) {
          throw new Error(
            `flatten: COMPOSE verb "${v.id}" has no "name" in params`,
          );
        }
        if (!registry) {
          throw new Error(
            `flatten: COMPOSE verb "${v.id}" references "${nestedName}" but no registry was provided`,
          );
        }
        const nested = registry.get(nestedName);
        if (!nested) {
          throw new Error(
            `flatten: COMPOSE verb "${v.id}" references unknown composition "${nestedName}"`,
          );
        }
        if (seenNames.has(nestedName)) {
          throw new Error(
            `flatten: cycle detected in composition registry at "${nestedName}"`,
          );
        }
        seenNames.add(nestedName);
        const newPrefix = prefix ? `${prefix}${sep}${v.id}` : v.id;
        visit(nested, newPrefix, depth + 1);
        seenNames.delete(nestedName);
      } else {
        const newId = prefix ? `${prefix}${sep}${v.id}` : v.id;
        flattenedVerbs.push(rewriteIds(v, prefix, sep) as AnyVerb);
        // We replace the id; rewriteIds already handled it.
        // But above we push the rewritten copy, so we don't need newId locally.
        void newId;
      }
    }
  };

  visit(unit, '', 0);

  return {
    ...unit,
    verbs: flattenedVerbs,
  };
}

/**
 * Prefix the id of a verb and rewrite every VerbRef inside its params.
 * Used by flatten() when inlining a nested composition.
 */
function rewriteIds(v: AnyVerb, prefix: string, sep: string): AnyVerb {
  if (!prefix) return v;
  const prefixed = (id: string): string => `${prefix}${sep}${id}`;

  // Deep-clone params, rewriting string fields that are known to carry VerbRefs.
  const p = JSON.parse(JSON.stringify(v.params)) as Record<string, unknown>;

  const rewriteOne = (obj: Record<string, unknown>, key: string) => {
    const val = obj[key];
    if (typeof val === 'string') {
      obj[key] = prefixed(val);
    }
  };
  const rewriteArray = (obj: Record<string, unknown>, key: string) => {
    const arr = obj[key];
    if (Array.isArray(arr)) {
      obj[key] = arr.map((x) => (typeof x === 'string' ? prefixed(x) : x));
    }
  };

  switch (v.verb) {
    case 'BRANCH': {
      const conds = p.conditions as Array<{ then: string }> | undefined;
      if (conds) for (const c of conds) c.then = prefixed(c.then);
      rewriteOne(p, 'default');
      break;
    }
    case 'SPLIT': {
      const paths = p.paths as Array<string | { path: string }> | undefined;
      if (paths) {
        p.paths = paths.map((x) =>
          typeof x === 'string' ? prefixed(x) : { ...x, path: prefixed(x.path) },
        );
      }
      break;
    }
    case 'MERGE':
      rewriteArray(p, 'inputs');
      break;
    case 'AWAIT':
    case 'SIGNAL':
      rewriteOne(p, 'fallback');
      break;
    case 'GATE':
      rewriteOne(p, 'on_timeout');
      break;
    case 'TERMINATE':
      rewriteArray(p, 'cleanup');
      break;
    case 'RETRY': {
      rewriteOne(p, 'target');
      const onE = p.on_exhausted as { target?: string } | undefined;
      if (onE?.target) onE.target = prefixed(onE.target);
      break;
    }
    case 'COMPENSATE':
      rewriteOne(p, 'action');
      break;
    case 'ERROR':
      rewriteOne(p, 'source');
      rewriteOne(p, 'handler');
      break;
    case 'VALIDATE': {
      const onF = p.on_fail as { target?: string } | undefined;
      if (onF?.target) onF.target = prefixed(onF.target);
      break;
    }
    case 'STREAM':
      rewriteOne(p, 'each');
      break;
    case 'CONFIGURE':
      rewriteOne(p, 'apply');
      break;
    case 'AUTHOR':
      rewriteOne(p, 'save');
      break;
    case 'ONBOARD':
      rewriteOne(p, 'completion');
      break;
    case 'DISPLAY': {
      const interact = p.interact as Array<{ action: string }> | undefined;
      if (interact) for (const i of interact) i.action = prefixed(i.action);
      break;
    }
    case 'ARRANGE':
      rewriteArray(p, 'children');
      break;
    case 'STATUS':
    case 'GUIDE':
      rewriteOne(p, 'action');
      break;
    case 'MONITOR': {
      const alerts = p.alerts as Array<{ action?: string }> | undefined;
      if (alerts)
        for (const a of alerts) if (a.action) a.action = prefixed(a.action);
      break;
    }
    default:
      break;
  }

  // next
  let nextVal: string | readonly string[] | null | undefined = v.next;
  if (typeof nextVal === 'string') nextVal = prefixed(nextVal);
  else if (Array.isArray(nextVal))
    nextVal = nextVal.map((n) => (typeof n === 'string' ? prefixed(n) : n));

  return {
    ...v,
    id: prefixed(v.id),
    params: p as AnyVerb['params'],
    ...(nextVal !== undefined ? { next: nextVal } : {}),
  } as AnyVerb;
}
