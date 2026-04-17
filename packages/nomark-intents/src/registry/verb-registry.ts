/**
 * Canonical verb registry for NOMARK Intents v0.4.
 *
 * Maps canonical English labels to language-neutral semantic IDs (0x01..0x1F),
 * categories, and semantic descriptions. Mirrors Appendix C of the spec.
 *
 * The English labels are canonical by convention. Teams may alias labels in
 * any language, but the wire format emits the canonical token.
 */

import type { VerbCategory, VerbName } from '../types/verb-names.js';

export interface VerbEntry {
  /** Language-neutral semantic ID, e.g. "0x01". */
  readonly id: string;
  /** Canonical English label. */
  readonly canonical: VerbName;
  /** Category bucket. */
  readonly category: VerbCategory;
  /** Semantic definition — language-neutral. */
  readonly semantic: string;
  /**
   * Type signature, as it appears in the spec.
   * Purely informational — the real enforcement happens via TypeScript.
   */
  readonly signature: string;
}

export const VERB_REGISTRY: readonly VerbEntry[] = [
  // Data
  {
    id: '0x01',
    canonical: 'FETCH',
    category: 'data',
    semantic: 'acquire data from external source, read-only, idempotent',
    signature: '(SourceSpec, AuthRef?, RetryPolicy?, Cache?) → Payload',
  },
  {
    id: '0x02',
    canonical: 'MAP',
    category: 'data',
    semantic: 'reshape single record, 1:1, pure function',
    signature: '(Payload, Expression) → Payload',
  },
  {
    id: '0x03',
    canonical: 'FILTER',
    category: 'data',
    semantic: 'reduce collection by predicate, n:≤n, pure function',
    signature: '(Payload[], Expression) → Payload[]',
  },
  {
    id: '0x04',
    canonical: 'REDUCE',
    category: 'data',
    semantic: 'aggregate collection to single value, n:1',
    signature: '(Payload[], Expression, any?) → Payload',
  },
  {
    id: '0x05',
    canonical: 'ENRICH',
    category: 'data',
    semantic: 'augment record with external data, 1:1 with side effect',
    signature: '(Payload, SourceSpec, Expression, string[]) → Payload',
  },
  {
    id: '0x06',
    canonical: 'PERSIST',
    category: 'data',
    semantic: 'write to sink, returns receipt for compensation',
    signature: '(Payload, SinkSpec, PersistMode, string?) → Receipt',
  },
  {
    id: '0x07',
    canonical: 'DELETE',
    category: 'data',
    semantic: 'remove from sink, soft or hard',
    signature: '(TargetSpec, SinkSpec, DeleteMode) → Receipt',
  },
  {
    id: '0x08',
    canonical: 'STREAM',
    category: 'data',
    semantic:
      'continuous receive and per-item processing, open channel until condition',
    signature: '(SourceSpec, VerbRef, Buffer?, Expression?, Backpressure?) → void',
  },
  // Flow
  {
    id: '0x09',
    canonical: 'AWAIT',
    category: 'flow',
    semantic: 'block until event, time, or signal',
    signature: '(EventSpec, Duration?, VerbRef?) → Payload',
  },
  {
    id: '0x0A',
    canonical: 'BRANCH',
    category: 'flow',
    semantic: 'exclusive conditional path selection',
    signature: '(Payload, Condition[], VerbRef) → VerbRef',
  },
  {
    id: '0x0B',
    canonical: 'SPLIT',
    category: 'flow',
    semantic: 'fan-out to parallel executions',
    signature: '(Payload, Strategy, VerbRef[] | ConditionalPath[]) → ExecutionRef[]',
  },
  {
    id: '0x0C',
    canonical: 'MERGE',
    category: 'flow',
    semantic: 'fan-in from parallel executions',
    signature: '(ExecutionRef[], Strategy, Duration?, Expression?) → Payload',
  },
  {
    id: '0x0D',
    canonical: 'GATE',
    category: 'flow',
    semantic: 'pause for human decision',
    signature:
      '(Payload, ActorSpec, string, string[]?, Duration?, VerbRef?) → Decision',
  },
  {
    id: '0x0E',
    canonical: 'SIGNAL',
    category: 'flow',
    semantic: 'await system or agent response',
    signature: '(SystemSpec, SignalSpec, Duration?, VerbRef?) → Payload',
  },
  {
    id: '0x0F',
    canonical: 'TERMINATE',
    category: 'flow',
    semantic: 'kill entire execution, all branches',
    signature: '(string, Status, VerbRef[]?) → void',
  },
  // Resilience
  {
    id: '0x10',
    canonical: 'RETRY',
    category: 'resilience',
    semantic: 're-attempt wrapped verb on failure',
    signature: '(VerbRef, RetryPolicy, ErrorRoute) → Payload | ErrorRoute',
  },
  {
    id: '0x11',
    canonical: 'COMPENSATE',
    category: 'resilience',
    semantic: 'reverse completed operation using receipt',
    signature: '(Receipt, VerbRef, bool, string?) → Receipt',
  },
  {
    id: '0x12',
    canonical: 'ERROR',
    category: 'resilience',
    semantic: 'catch failure, route to handler',
    signature: '(VerbRef, ErrorType[], VerbRef, bool?) → Payload | Terminate',
  },
  // Trust
  {
    id: '0x13',
    canonical: 'VALIDATE',
    category: 'trust',
    semantic: 'assert schema and business rules, trust boundary',
    signature: '(Payload, Schema | RuleSet, ErrorRoute) → Payload',
  },
  // Notification
  {
    id: '0x14',
    canonical: 'EMIT',
    category: 'notification',
    semantic: 'fire-and-forget message, at-least-once',
    signature: '(Payload, EmitSpec, true) → void',
  },
  // Outcome
  {
    id: '0x15',
    canonical: 'MONITOR',
    category: 'outcome',
    semantic: 'observe state, detect change, maintain awareness',
    signature: '(string, DataRef[], RefreshPolicy, Alert[]?, ViewRef?) → OutcomeSpec',
  },
  {
    id: '0x16',
    canonical: 'DECIDE',
    category: 'outcome',
    semantic: 'evaluate options, commit to one',
    signature:
      '(string, Option[], DataRef[], RuleRef[]?, Duration?, string?) → OutcomeSpec',
  },
  {
    id: '0x17',
    canonical: 'CONFIGURE',
    category: 'outcome',
    semantic: 'set parameters governing system behaviour',
    signature: '(string, ParamSpec[], DataRef?, VerbRef) → OutcomeSpec',
  },
  {
    id: '0x18',
    canonical: 'EXPLORE',
    category: 'outcome',
    semantic: 'navigate, search, discover, drill into detail',
    signature:
      '(string, DataRef | ViewRef, Search?, Filter?, ViewRef?, Sort?) → OutcomeSpec',
  },
  {
    id: '0x19',
    canonical: 'AUTHOR',
    category: 'outcome',
    semantic: 'create or edit structured content',
    signature:
      '(string, Schema, SaveMode, DataRef?, VerbRef, Duration?) → OutcomeSpec',
  },
  {
    id: '0x1A',
    canonical: 'ONBOARD',
    category: 'outcome',
    semantic: 'learn system, build mental model',
    signature: '(string, Step[], ProgressType, VerbRef) → OutcomeSpec',
  },
  // Present
  {
    id: '0x1B',
    canonical: 'DISPLAY',
    category: 'present',
    semantic: 'render data for actor consumption',
    signature:
      '(DisplayType, DataRef, Emphasis?, Interaction[]?, string?) → PresentSpec',
  },
  {
    id: '0x1C',
    canonical: 'COLLECT',
    category: 'present',
    semantic: 'gather input from actor',
    signature:
      '(CollectType, string, string, bool?, any?, Schema?, string?) → PresentSpec',
  },
  {
    id: '0x1D',
    canonical: 'ARRANGE',
    category: 'present',
    semantic: 'organise surfaces in space or sequence',
    signature: '(ArrangeType, PresentSpec[], Density?, Responsive[]?) → PresentSpec',
  },
  // Respond
  {
    id: '0x1E',
    canonical: 'STATUS',
    category: 'respond',
    semantic: 'communicate system state to actor',
    signature:
      '(StatusType, string?, DataRef?, VerbRef?, Dismiss?) → RespondSpec',
  },
  {
    id: '0x1F',
    canonical: 'GUIDE',
    category: 'respond',
    semantic: 'direct attention or suggest next action',
    signature:
      '(GuideType, string, Expression?, VerbRef?, Priority?, Dismiss?) → RespondSpec',
  },
];

/** Map: canonical name → registry entry. */
export const VERB_BY_NAME: ReadonlyMap<VerbName, VerbEntry> = new Map(
  VERB_REGISTRY.map((e) => [e.canonical, e]),
);

/** Map: semantic ID → registry entry. */
export const VERB_BY_ID: ReadonlyMap<string, VerbEntry> = new Map(
  VERB_REGISTRY.map((e) => [e.id, e]),
);

/** All computation verb names (categories: data, flow, resilience, trust, notification). */
export const COMPUTATION_CATEGORIES: ReadonlySet<VerbCategory> = new Set<VerbCategory>([
  'data',
  'flow',
  'resilience',
  'trust',
  'notification',
]);

/** All surface verb names (categories: outcome, present, respond). */
export const SURFACE_CATEGORIES: ReadonlySet<VerbCategory> = new Set<VerbCategory>([
  'outcome',
  'present',
  'respond',
]);

/** Classify a verb name as computation, surface, or grammar. */
export function classifyVerb(
  name: VerbName,
): 'computation' | 'surface' | 'grammar' {
  if (name === 'COMPOSE') return 'grammar';
  const entry = VERB_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`Unknown verb: ${name}`);
  }
  return COMPUTATION_CATEGORIES.has(entry.category) ? 'computation' : 'surface';
}

/** List of all computation verb names, in spec order. */
export const COMPUTATION_VERBS: readonly VerbName[] = VERB_REGISTRY
  .filter((e) => COMPUTATION_CATEGORIES.has(e.category))
  .map((e) => e.canonical);

/** List of all surface verb names, in spec order. */
export const SURFACE_VERBS: readonly VerbName[] = VERB_REGISTRY
  .filter((e) => SURFACE_CATEGORIES.has(e.category))
  .map((e) => e.canonical);
