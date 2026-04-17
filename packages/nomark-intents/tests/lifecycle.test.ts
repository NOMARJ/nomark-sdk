import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIFECYCLE,
  classifyLifecycle,
  reachableStates,
  operationFor,
  compose,
  MAP,
} from '../src/index.js';

const trivialOp = compose({
  name: 'op',
  version: '1.0.0',
  input_schema: {},
  output_schema: {},
  verbs: [MAP('x', { expression: 'x' })],
});

describe('LIFECYCLE', () => {
  it('builds a progression lifecycle', () => {
    const lc = LIFECYCLE({
      name: 'hospital_visit',
      domain: 'healthcare',
      version: '1.0.0',
      entity: { $ref: '#/schemas/visit' },
      states: ['ADMITTED', 'IN_TREATMENT', 'DISCHARGED'],
      operations: { admit: trivialOp, treat: trivialOp, discharge: trivialOp },
      transitions: [
        { from: 'ADMITTED', via: 'treat', to: 'IN_TREATMENT' },
        { from: 'IN_TREATMENT', via: 'discharge', to: 'DISCHARGED' },
      ],
    });
    assert.equal(classifyLifecycle(lc), 'progression');
  });

  it('classifies mirror pairs', () => {
    const lc = LIFECYCLE({
      name: 'trade',
      domain: 'trading',
      version: '1.0.0',
      entity: {},
      states: ['OPEN', 'CLOSED'],
      operations: { buy: trivialOp, sell: trivialOp },
      transitions: [
        { from: 'OPEN', via: 'buy', to: 'CLOSED' },
        { from: 'CLOSED', via: 'sell', to: 'OPEN' },
      ],
    });
    assert.equal(classifyLifecycle(lc), 'mirror');
  });

  it('classifies branching', () => {
    const lc = LIFECYCLE({
      name: 'subscription',
      domain: 'saas',
      version: '1.0.0',
      entity: {},
      states: ['ACTIVE', 'UPGRADED', 'DOWNGRADED', 'CHURNED'],
      operations: { upgrade: trivialOp, downgrade: trivialOp, churn: trivialOp },
      transitions: [
        { from: 'ACTIVE', via: 'upgrade', to: 'UPGRADED' },
        { from: 'ACTIVE', via: 'downgrade', to: 'DOWNGRADED' },
        { from: 'ACTIVE', via: 'churn', to: 'CHURNED' },
      ],
    });
    assert.equal(classifyLifecycle(lc), 'branching');
  });

  it('computes reachable states', () => {
    const lc = LIFECYCLE({
      name: 'test',
      domain: 'x',
      version: '1.0.0',
      entity: {},
      states: ['A', 'B', 'C', 'D'],
      operations: { f: trivialOp, g: trivialOp },
      transitions: [
        { from: 'A', via: 'f', to: 'B' },
        { from: 'B', via: 'g', to: 'C' },
      ],
    });
    assert.deepEqual(reachableStates(lc, 'A').slice().sort(), ['A', 'B', 'C']);
    assert.equal(operationFor(lc, 'A', 'B'), 'f');
    assert.equal(operationFor(lc, 'A', 'D'), null);
  });

  it('rejects transitions to undeclared states', () => {
    assert.throws(
      () =>
        LIFECYCLE({
          name: 'bad',
          domain: 'x',
          version: '1.0.0',
          entity: {},
          states: ['A'],
          operations: { f: trivialOp },
          transitions: [{ from: 'A', via: 'f', to: 'ZZZ' }],
        }),
      /unknown to-state "ZZZ"/,
    );
  });
});
