import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FETCH,
  MAP,
  PERSIST,
  BRANCH,
  SPLIT,
  MERGE,
  EMIT,
  compose,
  isComposedUnit,
} from '../src/index.js';

describe('compose()', () => {
  it('builds a minimal composition', () => {
    const unit = compose({
      name: 'Trivial',
      version: '1.0.0',
      input_schema: { type: 'object' },
      output_schema: { type: 'object' },
      verbs: [
        FETCH('get', {
          source: { type: 'http', config: { url: 'https://x' } },
        }),
      ],
    });
    assert.equal(unit.compose, 'Trivial');
    assert.ok(isComposedUnit(unit));
  });

  it('rejects invalid semver', () => {
    assert.throws(
      () =>
        compose({
          name: 'X',
          version: 'latest',
          input_schema: {},
          output_schema: {},
          verbs: [MAP('m', { expression: 'x' })],
        }),
      /semver/,
    );
  });

  it('rejects duplicate verb ids', () => {
    assert.throws(
      () =>
        compose({
          name: 'Dup',
          version: '1.0.0',
          input_schema: {},
          output_schema: {},
          verbs: [
            MAP('a', { expression: 'x' }),
            MAP('a', { expression: 'y' }),
          ],
        }),
      /duplicate verb id "a"/,
    );
  });

  it('rejects BRANCH pointing to unknown id', () => {
    assert.throws(
      () =>
        compose({
          name: 'B',
          version: '1.0.0',
          input_schema: {},
          output_schema: {},
          verbs: [
            MAP('m', { expression: 'x' }),
            BRANCH('route', {
              conditions: [{ test: 'x > 0', then: 'nonexistent' }],
              default: 'm',
            }),
          ],
        }),
      /unknown verb "nonexistent"/,
    );
  });

  it('allows SPLIT/MERGE with proper references', () => {
    const unit = compose({
      name: 'Parallel',
      version: '1.0.0',
      input_schema: {},
      output_schema: {},
      verbs: [
        SPLIT('scatter', {
          strategy: 'all',
          paths: ['work_a', 'work_b'],
        }),
        MAP('work_a', { expression: 'x + 1' }),
        MAP('work_b', { expression: 'x * 2' }),
        MERGE('gather', {
          inputs: ['work_a', 'work_b'],
          strategy: 'all',
        }),
      ],
    });
    assert.equal(unit.verbs.length, 4);
  });

  it('rejects compensations referencing unknown verbs', () => {
    assert.throws(
      () =>
        compose({
          name: 'C',
          version: '1.0.0',
          input_schema: {},
          output_schema: {},
          verbs: [
            PERSIST('save', {
              sink: { type: 'sql', config: {} },
              mode: 'insert',
            }),
          ],
          compensations: { save: 'doesnotexist' },
        }),
      /compensation reverser "doesnotexist"/,
    );
  });

  it('rejects entity references to undeclared entities', () => {
    assert.throws(
      () =>
        compose({
          name: 'E',
          version: '1.0.0',
          input_schema: {},
          output_schema: {},
          entities: {
            trade: { schema: {}, role: 'primary' },
          },
          verbs: [
            PERSIST(
              'save',
              {
                sink: { type: 'sql', config: {} },
                mode: 'insert',
              },
              { entity: 'unknown' },
            ),
          ],
        }),
      /unknown entity "unknown"/,
    );
  });

  it('accepts entity references to declared entities', () => {
    const unit = compose({
      name: 'E',
      version: '1.0.0',
      input_schema: {},
      output_schema: {},
      entities: {
        trade: { schema: {}, role: 'primary' },
      },
      verbs: [
        PERSIST(
          'save',
          { sink: { type: 'sql', config: {} }, mode: 'insert' },
          { entity: 'trade' },
        ),
        EMIT('notify', {
          target: { type: 'slack', config: { channel: '#x' } },
        }),
      ],
    });
    assert.equal(unit.entities?.trade?.role, 'primary');
  });
});
