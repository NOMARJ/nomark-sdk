/**
 * Composition validator.
 *
 * Performs semantic checks beyond what compose() does at construction:
 *   - Cycle detection across BRANCH/SPLIT/MERGE/next edges
 *   - MERGE input integrity (must reference prior SPLIT executions)
 *   - Compensation map coverage (every PERSIST/DELETE/EMIT should have
 *     a compensation, warned but not errored)
 *   - Cost budget static checks (verb count, parallel fan-out)
 *   - Entity coverage: every PERSIST/DELETE with multiple entity targets
 *     should declare entities
 *   - Target hint consistency: computation-only compositions shouldn't
 *     declare a surface target; surface-only shouldn't declare compute
 */

import type { ComposedUnit } from '../compose/composed-unit.js';
import { __collectVerbRefs } from '../compose/compose.js';
import type { AnyVerb } from '../types/params-map.js';
import { classifyVerb } from '../registry/verb-registry.js';

// ────────────────────────────────────────────────────────────────
// Diagnostic types
// ────────────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  readonly severity: Severity;
  readonly code: string;
  readonly message: string;
  /** Verb id the diagnostic attaches to, if any. */
  readonly verb_id?: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
  /** Convenience: filtered list of errors. */
  readonly errors: readonly Diagnostic[];
  /** Convenience: filtered list of warnings. */
  readonly warnings: readonly Diagnostic[];
}

// ────────────────────────────────────────────────────────────────
// Validator
// ────────────────────────────────────────────────────────────────

export function validate(unit: ComposedUnit): ValidationResult {
  const diagnostics: Diagnostic[] = [];

  const byId = new Map<string, AnyVerb>(unit.verbs.map((v) => [v.id, v]));

  // Build edge set: id → list of ids it references.
  const edges = new Map<string, string[]>();
  for (const v of unit.verbs) {
    const refs = [...__collectVerbRefs(v)];
    if (v.next) {
      const nexts = Array.isArray(v.next) ? v.next : [v.next];
      for (const n of nexts) if (n) refs.push(n);
    }
    edges.set(v.id, refs);
  }

  // ─── Cycle detection (DFS with colouring) ────────────────────
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>();
  for (const id of byId.keys()) colour.set(id, WHITE);

  const detectCycle = (start: string): string[] | null => {
    const stack: Array<{ id: string; iter: Iterator<string> }> = [];
    const pathOrder: string[] = [];

    const push = (id: string): string[] | null => {
      colour.set(id, GREY);
      pathOrder.push(id);
      stack.push({ id, iter: (edges.get(id) ?? [])[Symbol.iterator]() });
      return null;
    };

    push(start);

    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const next = top.iter.next();
      if (next.done) {
        colour.set(top.id, BLACK);
        pathOrder.pop();
        stack.pop();
        continue;
      }
      const childId = next.value;
      const c = colour.get(childId);
      if (c === GREY) {
        // Cycle: return the cycle path.
        const cycleStart = pathOrder.indexOf(childId);
        return [...pathOrder.slice(cycleStart), childId];
      }
      if (c === WHITE) push(childId);
    }
    return null;
  };

  for (const id of byId.keys()) {
    if (colour.get(id) === WHITE) {
      const cycle = detectCycle(id);
      if (cycle) {
        diagnostics.push({
          severity: 'error',
          code: 'CYCLE_DETECTED',
          message: `Cycle detected: ${cycle.join(' → ')}`,
          verb_id: cycle[0],
        });
        break; // One cycle diagnostic is enough — fix it then re-run.
      }
    }
  }

  // ─── MERGE integrity: inputs should reference SPLIT-produced verbs ───
  for (const v of unit.verbs) {
    if (v.verb !== 'MERGE') continue;
    const inputs = (v.params as { inputs?: readonly string[] }).inputs ?? [];
    for (const inputId of inputs) {
      const referenced = byId.get(inputId);
      if (!referenced) continue; // compose() already reports unknown refs
      // Advisory: the merge input should typically be downstream of a SPLIT.
      // We cannot fully verify dataflow here without a complete dataflow pass,
      // but we can check that at least one SPLIT exists and lists this id as a path.
      const hasSplitAncestor = unit.verbs.some((candidate) => {
        if (candidate.verb !== 'SPLIT') return false;
        const paths =
          (candidate.params as {
            paths?: ReadonlyArray<string | { path?: string }>;
          }).paths ?? [];
        return paths.some((p) =>
          typeof p === 'string' ? p === inputId : p?.path === inputId,
        );
      });
      if (!hasSplitAncestor) {
        diagnostics.push({
          severity: 'warning',
          code: 'MERGE_INPUT_NO_SPLIT',
          message: `MERGE input "${inputId}" is not listed under any SPLIT.paths; this may indicate missing fan-out.`,
          verb_id: v.id,
        });
      }
    }
  }

  // ─── Compensation coverage ──────────────────────────────────
  const receiptProducers = unit.verbs.filter(
    (v) => v.verb === 'PERSIST' || v.verb === 'DELETE',
  );
  const compensated = new Set(Object.keys(unit.compensations ?? {}));
  for (const v of receiptProducers) {
    if (!compensated.has(v.id)) {
      diagnostics.push({
        severity: 'warning',
        code: 'MISSING_COMPENSATION',
        message: `Verb "${v.id}" (${v.verb}) produces a Receipt but has no entry in the compensation map.`,
        verb_id: v.id,
      });
    }
  }

  // ─── Cost budget static checks ──────────────────────────────
  const budget = unit.budget;
  if (budget?.max_verbs !== undefined && unit.verbs.length > budget.max_verbs) {
    diagnostics.push({
      severity: 'error',
      code: 'BUDGET_EXCEEDED_VERBS',
      message: `Composition has ${unit.verbs.length} verbs; budget.max_verbs is ${budget.max_verbs}.`,
    });
  }
  if (budget?.max_parallel !== undefined) {
    const maxFanOut = unit.verbs
      .filter((v) => v.verb === 'SPLIT')
      .reduce((m, v) => {
        const paths =
          (v.params as { paths?: ReadonlyArray<unknown> }).paths?.length ?? 0;
        return Math.max(m, paths);
      }, 0);
    if (maxFanOut > budget.max_parallel) {
      diagnostics.push({
        severity: 'error',
        code: 'BUDGET_EXCEEDED_PARALLEL',
        message: `Max SPLIT fan-out is ${maxFanOut}; budget.max_parallel is ${budget.max_parallel}.`,
      });
    }
  }
  if (budget?.max_external_calls !== undefined) {
    // Count calls that definitely reach outside: FETCH, ENRICH, PERSIST, DELETE,
    // EMIT, SIGNAL, STREAM (source), MONITOR refresh (not a call), ONBOARD (n/a).
    const externalCount = unit.verbs.filter((v) =>
      ['FETCH', 'ENRICH', 'PERSIST', 'DELETE', 'EMIT', 'SIGNAL', 'STREAM'].includes(
        v.verb,
      ),
    ).length;
    if (externalCount > budget.max_external_calls) {
      diagnostics.push({
        severity: 'warning',
        code: 'BUDGET_EXCEEDED_EXTERNAL_CALLS',
        message: `Composition has ${externalCount} potential external calls; budget.max_external_calls is ${budget.max_external_calls}.`,
      });
    }
  }

  // ─── Entity consistency ─────────────────────────────────────
  if (unit.entities) {
    const hasPrimary = Object.values(unit.entities).some(
      (e) => e.role === 'primary',
    );
    if (!hasPrimary) {
      diagnostics.push({
        severity: 'warning',
        code: 'NO_PRIMARY_ENTITY',
        message:
          'Entity graph is declared but no entity has role="primary". Multi-entity sagas should designate a primary entity.',
      });
    }
  }

  // ─── Target hint consistency ────────────────────────────────
  if (unit.target) {
    const kinds = new Set(unit.verbs.map((v) => classifyVerb(v.verb)));
    const hasComputation = kinds.has('computation');
    const hasSurface = kinds.has('surface');

    if (!hasComputation && unit.target.compute) {
      diagnostics.push({
        severity: 'info',
        code: 'TARGET_COMPUTE_UNUSED',
        message:
          'target.compute declared but composition contains no computation verbs.',
      });
    }
    if (!hasSurface && unit.target.surface) {
      diagnostics.push({
        severity: 'info',
        code: 'TARGET_SURFACE_UNUSED',
        message:
          'target.surface declared but composition contains no surface verbs.',
      });
    }
  }

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  return {
    ok: errors.length === 0,
    diagnostics,
    errors,
    warnings,
  };
}

/**
 * Throw if validation produces any errors. Warnings are not fatal.
 * Convenience wrapper for CI pipelines.
 */
export function assertValid(unit: ComposedUnit): void {
  const result = validate(unit);
  if (!result.ok) {
    const lines = result.errors.map(
      (e) => `  [${e.code}]${e.verb_id ? ` @${e.verb_id}:` : ':'} ${e.message}`,
    );
    throw new Error(
      `Composition "${unit.compose}" failed validation:\n${lines.join('\n')}`,
    );
  }
}
