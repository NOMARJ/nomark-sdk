/**
 * Verb-to-params type mapping.
 *
 * This is the canonical map from verb name to parameter shape.
 * Used by verb builders to enforce correct params at compile time.
 */

import type { VerbInstance, VerbName } from './verb-names.js';
export type { VerbName } from './verb-names.js';
import type {
  DeleteParams,
  EnrichParams,
  FetchParams,
  FilterParams,
  MapParams,
  PersistParams,
  ReduceParams,
  StreamParams,
} from './data-params.js';
import type {
  AwaitParams,
  BranchParams,
  GateParams,
  MergeParams,
  SignalParams,
  SplitParams,
  TerminateParams,
} from './flow-params.js';
import type {
  CompensateParams,
  EmitParams,
  ErrorParams,
  RetryParams,
  ValidateParams,
} from './resilience-params.js';
import type {
  AuthorParams,
  ConfigureParams,
  DecideParams,
  ExploreParams,
  MonitorParams,
  OnboardParams,
} from './outcome-params.js';
import type {
  ArrangeParams,
  CollectParams,
  DisplayParams,
  GuideParams,
  StatusParams,
} from './surface-params.js';

/**
 * Central verb → params type map.
 *
 * `COMPOSE` is a special grammar verb that the `compose()` builder handles
 * directly; it is not authored as a bare VerbInstance.
 */
export interface VerbParamsMap {
  // Data
  FETCH: FetchParams;
  MAP: MapParams;
  FILTER: FilterParams;
  REDUCE: ReduceParams;
  ENRICH: EnrichParams;
  PERSIST: PersistParams;
  DELETE: DeleteParams;
  STREAM: StreamParams;
  // Flow
  AWAIT: AwaitParams;
  BRANCH: BranchParams;
  SPLIT: SplitParams;
  MERGE: MergeParams;
  GATE: GateParams;
  SIGNAL: SignalParams;
  TERMINATE: TerminateParams;
  // Resilience
  RETRY: RetryParams;
  COMPENSATE: CompensateParams;
  ERROR: ErrorParams;
  // Trust
  VALIDATE: ValidateParams;
  // Notification
  EMIT: EmitParams;
  // Outcome
  MONITOR: MonitorParams;
  DECIDE: DecideParams;
  CONFIGURE: ConfigureParams;
  EXPLORE: ExploreParams;
  AUTHOR: AuthorParams;
  ONBOARD: OnboardParams;
  // Present
  DISPLAY: DisplayParams;
  COLLECT: CollectParams;
  ARRANGE: ArrangeParams;
  // Respond
  STATUS: StatusParams;
  GUIDE: GuideParams;
  // Grammar (placeholder — compositions are authored via compose())
  COMPOSE: Record<string, unknown>;
}

/** Extract the params type for a given verb name. */
export type ParamsOf<V extends VerbName> = VerbParamsMap[V];

/** A typed VerbInstance for a specific verb. */
export type TypedVerb<V extends VerbName> = VerbInstance<V, ParamsOf<V>>;

/** A verb instance of any type — the heterogeneous element of composition bodies. */
export type AnyVerb = {
  [V in VerbName]: TypedVerb<V>;
}[VerbName];
