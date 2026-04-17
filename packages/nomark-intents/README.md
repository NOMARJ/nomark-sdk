# @nomark/intents

**NOMARK Intents Specification v0.4 — TypeScript SDK**

31 verbs + 1 grammar rule. Computation and surface, unified. The interlingua between meaning and execution.

- 📖 **Specification:** Open standard, Apache 2.0
- 🤖 **First-class consumer:** LLMs. Humans inspect; machines author and execute.
- 🎯 **This package:** types, verb builders, composition grammar, validator, flatten compiler, and the canonical verb registry

Verified resolvers (code generation, UI compilation, Sigil security audit) are commercial under BSL 1.1 and shipped separately.

---

## Install

```bash
npm install @nomark/intents
```

## 90-second tour

```ts
import {
  FETCH, MAP, FILTER, REDUCE, ENRICH, PERSIST, VALIDATE, EMIT, AWAIT,
  MONITOR, DISPLAY, ARRANGE, STATUS, GUIDE,
  compose, validate, assertValid,
} from '@nomark/intents';

// Pure computation — a cron-triggered ETL pipeline.
const ETL = compose({
  name: 'DAILY_FUND_FLOW_ETL',
  version: '1.0.0',
  input_schema: { type: 'object', properties: { date: { format: 'date' } } },
  output_schema: { $ref: '#/schemas/etl_receipt' },
  verbs: [
    AWAIT('trigger', {
      on: { type: 'cron', config: { expression: '0 6 * * *' } },
    }),
    FETCH('extract', {
      source: { type: 'sql', config: { query: 'SELECT * FROM raw_flows' } },
    }),
    VALIDATE('check', {
      rules: { $ref: '#/rules/flow_schema' },
      on_fail: { action: 'route', target: 'alert' },
    }),
    FILTER('clean', { predicate: 'row.amount != null' }),
    REDUCE('aggregate', { expression: 'group_by(fund_id).sum(amount)' }),
    PERSIST('load', {
      sink: { type: 'sql', config: { table: 'fund_flows_daily' } },
      mode: 'upsert',
      idempotency_key: 'fund_id+date',
    }),
    EMIT('notify', {
      target: { type: 'slack', config: { channel: '#data-ops' } },
    }),
    EMIT('alert', {
      target: { type: 'email', config: { to: 'ops@example.com' } },
    }),
  ],
  error_policy: { default: { action: 'route', target: 'alert' } },
  target: { compute: 'python' },
});

assertValid(ETL); // throws on error-level diagnostics
```

The same composition can mix **surface** verbs (`MONITOR`, `DISPLAY`, `ARRANGE`, `STATUS`, `GUIDE`, `DECIDE`, `CONFIGURE`, `EXPLORE`, `AUTHOR`, `ONBOARD`, `COLLECT`) with computation verbs. The resolver splits by target tag at compile time.

## The 31 verbs

| Category        | Verbs |
|-----------------|-------|
| **Data** (8)    | `FETCH` `MAP` `FILTER` `REDUCE` `ENRICH` `PERSIST` `DELETE` `STREAM` |
| **Flow** (7)    | `AWAIT` `BRANCH` `SPLIT` `MERGE` `GATE` `SIGNAL` `TERMINATE` |
| **Resilience** (3) | `RETRY` `COMPENSATE` `ERROR` |
| **Trust** (1)   | `VALIDATE` |
| **Notification** (1) | `EMIT` |
| **Outcome** (6) | `MONITOR` `DECIDE` `CONFIGURE` `EXPLORE` `AUTHOR` `ONBOARD` |
| **Present** (3) | `DISPLAY` `COLLECT` `ARRANGE` |
| **Respond** (2) | `STATUS` `GUIDE` |
| **Grammar** (1) | `compose()` |

Each verb has a language-neutral semantic ID (`0x01`–`0x1F`) available via the registry:

```ts
import { VERB_BY_NAME, VERB_BY_ID, classifyVerb } from '@nomark/intents';

VERB_BY_NAME.get('FETCH')?.id;        // '0x01'
VERB_BY_ID.get('0x1F')?.canonical;    // 'GUIDE'
classifyVerb('DISPLAY');              // 'surface'
classifyVerb('FETCH');                // 'computation'
classifyVerb('COMPOSE');              // 'grammar'
```

## Composition grammar

A `ComposedUnit` is the canonical serialisable form. It carries identity, schema boundaries, an optional entity graph for multi-entity sagas, the verb body, an error policy, a compensation map for rollback, a cost budget, and target hints.

```ts
import { compose, PERSIST, EMIT } from '@nomark/intents';

const TRADE_BUY = compose({
  name: 'TRADE_BUY',
  version: '1.0.0',
  input_schema: { $ref: '#/schemas/order' },
  output_schema: { $ref: '#/schemas/trade_receipt' },

  // Multi-entity saga (spec §5.2)
  entities: {
    trade:    { schema: { $ref: '#/schemas/trade' },    role: 'primary' },
    position: { schema: { $ref: '#/schemas/position' }, role: 'affected' },
    cash:     { schema: { $ref: '#/schemas/cash' },     role: 'affected' },
  },
  verbs: [
    PERSIST('book',        { sink: { type: 'sql', config: { table: 'trades' }},    mode: 'insert' }, { entity: 'trade' }),
    PERSIST('update_pos',  { sink: { type: 'sql', config: { table: 'positions' }}, mode: 'upsert' }, { entity: 'position' }),
    PERSIST('update_cash', { sink: { type: 'sql', config: { table: 'cash' }},      mode: 'upsert' }, { entity: 'cash' }),
    // compensation targets (stubs)
    EMIT('cancel_trade',   { target: { type: 'queue', config: { topic: 'trades.cancel' }}}),
    EMIT('reverse_pos',    { target: { type: 'queue', config: { topic: 'pos.reverse' }}}),
    EMIT('reverse_cash',   { target: { type: 'queue', config: { topic: 'cash.reverse' }}}),
  ],
  // Traversed in reverse order at COMPENSATE time (saga rollback)
  compensations: {
    book:        'cancel_trade',
    update_pos:  'reverse_pos',
    update_cash: 'reverse_cash',
  },
  budget: { max_verbs: 20, max_external_calls: 10 },
  target: { compute: 'typescript', surface: 'api' },
});
```

### Structural validation — `compose()`

`compose()` rejects at construction time:

- Invalid semver
- Duplicate verb ids
- `BRANCH` / `SPLIT` / `MERGE` / `RETRY` / `ERROR` / `GATE` / `STATUS` / `GUIDE` / `DISPLAY` / `ARRANGE` / etc. references to unknown ids
- `next` references to unknown ids
- Entity references to undeclared entities
- `compensations` keys or reversers that don't exist

### Semantic validation — `validate()`

```ts
import { validate, assertValid } from '@nomark/intents';

const result = validate(myComposition);
// result.ok         — boolean
// result.errors     — Diagnostic[] (fatal)
// result.warnings   — Diagnostic[] (advisory)
// result.diagnostics — full list

assertValid(myComposition); // throws on any error-level diagnostic
```

Diagnostic codes include:

| Code | Severity | Meaning |
|------|----------|---------|
| `CYCLE_DETECTED` | error | Composition graph contains a cycle |
| `BUDGET_EXCEEDED_VERBS` | error | More verbs than `budget.max_verbs` |
| `BUDGET_EXCEEDED_PARALLEL` | error | SPLIT fan-out exceeds `budget.max_parallel` |
| `BUDGET_EXCEEDED_EXTERNAL_CALLS` | warning | More external-reaching verbs than budgeted |
| `MISSING_COMPENSATION` | warning | `PERSIST` or `DELETE` with no entry in the compensation map |
| `MERGE_INPUT_NO_SPLIT` | warning | `MERGE` references an input not produced by any `SPLIT` |
| `NO_PRIMARY_ENTITY` | warning | Entity graph declared without a `primary` role |
| `TARGET_COMPUTE_UNUSED` | info | `target.compute` declared but no computation verbs present |
| `TARGET_SURFACE_UNUSED` | info | `target.surface` declared but no surface verbs present |

### Flatten compiler — `flatten()`

Nested compositions (`verb: 'COMPOSE'` entries referencing registered compositions) are inlined with id-prefixing:

```ts
import { flatten } from '@nomark/intents';

const registry = new Map([
  ['SUB_FLOW', subFlowUnit],
]);
const flat = flatten(parentUnit, { registry, separator: '.' });
```

Cycles in the registry are detected and rejected.

## Lifecycle layer (spec §6)

```ts
import {
  LIFECYCLE, classifyLifecycle, reachableStates, operationFor,
} from '@nomark/intents';

const TRADE = LIFECYCLE({
  name: 'trade_order',
  domain: 'trading',
  version: '1.0.0',
  entity: { $ref: '#/schemas/trade' },
  states: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SETTLED'],
  operations: { submit, approve, reject, settle },
  transitions: [
    { from: 'DRAFT',     via: 'submit',  to: 'PENDING'  },
    { from: 'PENDING',   via: 'approve', to: 'APPROVED' },
    { from: 'PENDING',   via: 'reject',  to: 'REJECTED' },
    { from: 'APPROVED',  via: 'settle',  to: 'SETTLED'  },
  ],
});

classifyLifecycle(TRADE);               // 'branching' | 'mirror' | 'progression' | 'mixed'
reachableStates(TRADE, 'DRAFT');        // ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SETTLED']
operationFor(TRADE, 'PENDING', 'APPROVED'); // 'approve'
```

## Worked examples

The spec's four worked examples from §7 are shipped as `@nomark/intents/examples`:

```ts
import {
  DAILY_FUND_FLOW_ETL,      // §7.1 — ETL pipeline (computation only)
  FUND_FLOW_DASHBOARD,      // §7.2 — Dashboard (computation + surface)
  TRADE_APPROVAL,           // §7.3 — Human-gated approval
  DEPLOY_WITH_DASHBOARD,    // §7.4 — Deploy with rollback
  TRADE_LIFECYCLE,          // §6  — Lifecycle using the above as operations
} from '@nomark/intents/examples';
```

## Targets

A `ComposedUnit` carries optional target hints which the resolver consumes:

```ts
target: {
  compute: 'python' | 'typescript' | 'sql' | 'rust' | string,
  surface: 'react' | 'swiftui' | 'html' | 'api' | 'cli' | 'slack' | 'pdf' | 'voice' | string,
  design?: 'path/to/DESIGN.md',
}
```

The spec is indifferent to the target. Same intent, different target tags, different resolver outputs.

## What this package is not

- **Not a runtime.** It produces `ComposedUnit` values. A resolver turns them into running code or UI.
- **Not opinionated about expressions.** Expression strings are opaque — the resolver interprets the syntax (JavaScript, Python, SQL, JSONata, or whatever makes sense for the target).
- **Not a framework.** The vocabulary is free. The verified resolvers that guarantee correct compilation are the commercial product.

## Ownership

- **Spec + this SDK:** Apache 2.0, open
- **Verified resolvers:** NOMARK commercial, BSL 1.1
- **Sigil integration:** NOMARK commercial

## Contributing

New verbs are added only when:
1. Three or more independent systems have converged on the same primitive
2. The concept cannot be expressed as a composition of existing verbs
3. Adding it does not break existing compositions
4. It has distinct execution characteristics that justify separation

See the spec's §11.2 Extension Policy for the bar.

---

*NOMARK Intents Specification v0.4 — 31 verbs. 1 grammar rule. Computation and surface, unified.*
