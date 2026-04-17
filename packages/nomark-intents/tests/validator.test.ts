import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRANCH,
  FETCH,
  MAP,
  PERSIST,
  compose,
  validate,
  assertValid,
} from '../src/index.js';
import {
  DAILY_FUND_FLOW_ETL,
  FUND_FLOW_DASHBOARD,
  TRADE_APPROVAL,
  DEPLOY_WITH_DASHBOARD,
} from '../src/examples/index.js';

describe('validator', () => {
  it('detects cycles via BRANCH', () => {
    // Cycle intentionally created by post-hoc mutation, because compose()
    // would otherwise reject unknown references. We build a linear composition
    // and then construct a cyclic version by reusing the refs that *do* exist.
    const unit = compose({
      name: 'Cycle',
      version: '1.0.0',
      input_schema: {},
      output_schema: {},
      verbs: [
        MAP('a', { expression: 'x' }),
        MAP('b', { expression: 'x' }),
        BRANCH('route_ab', {
          conditions: [{ test: 'true', then: 'a' }],
          default: 'b',
        }),
        BRANCH('route_back', {
          conditions: [{ test: 'true', then: 'route_ab' }],
          default: 'a',
        }),
      ],
    });
    // Wire a cycle: 'a' -> route_ab -> a via next
    const cyclicUnit = {
      ...unit,
      verbs: unit.verbs.map((v) =>
        v.id === 'a' ? { ...v, next: 'route_ab' } : v,
      ),
    };
    const result = validate(cyclicUnit as typeof unit);
    assert.ok(!result.ok);
    assert.ok(
      result.errors.some((e) => e.code === 'CYCLE_DETECTED'),
      'expected CYCLE_DETECTED error',
    );
  });

  it('flags missing compensation for PERSIST as warning', () => {
    const unit = compose({
      name: 'NoComp',
      version: '1.0.0',
      input_schema: {},
      output_schema: {},
      verbs: [
        PERSIST('save', {
          sink: { type: 'sql', config: {} },
          mode: 'insert',
        }),
      ],
    });
    const result = validate(unit);
    assert.ok(result.ok, 'missing compensation is a warning, not an error');
    assert.ok(
      result.warnings.some((d) => d.code === 'MISSING_COMPENSATION'),
    );
  });

  it('enforces max_verbs budget', () => {
    const unit = compose({
      name: 'Budget',
      version: '1.0.0',
      input_schema: {},
      output_schema: {},
      verbs: [
        FETCH('f', { source: { type: 'http', config: { url: 'x' } } }),
        MAP('m', { expression: 'x' }),
      ],
      budget: { max_verbs: 1 },
    });
    const result = validate(unit);
    assert.ok(!result.ok);
    assert.ok(result.errors.some((e) => e.code === 'BUDGET_EXCEEDED_VERBS'));
  });

  it('assertValid throws on error diagnostics', () => {
    const unit = compose({
      name: 'Throws',
      version: '1.0.0',
      input_schema: {},
      output_schema: {},
      verbs: [MAP('a', { expression: 'x' })],
      budget: { max_verbs: 0 },
    });
    assert.throws(() => assertValid(unit), /failed validation/);
  });
});

describe('validator — worked examples', () => {
  it('ETL pipeline validates (warnings only)', () => {
    const r = validate(DAILY_FUND_FLOW_ETL);
    assert.ok(r.ok, `ETL errors: ${JSON.stringify(r.errors)}`);
  });

  it('Fund dashboard validates', () => {
    const r = validate(FUND_FLOW_DASHBOARD);
    assert.ok(r.ok, `Dashboard errors: ${JSON.stringify(r.errors)}`);
  });

  it('Trade approval validates', () => {
    const r = validate(TRADE_APPROVAL);
    assert.ok(r.ok, `Trade approval errors: ${JSON.stringify(r.errors)}`);
  });

  it('Deploy pipeline validates', () => {
    const r = validate(DEPLOY_WITH_DASHBOARD);
    assert.ok(r.ok, `Deploy errors: ${JSON.stringify(r.errors)}`);
  });
});
