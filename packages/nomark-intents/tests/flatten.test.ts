import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FETCH,
  MAP,
  PERSIST,
  compose,
  flatten,
} from '../src/index.js';

describe('flatten()', () => {
  it('returns the unit unchanged when no nested COMPOSE refs exist', () => {
    const unit = compose({
      name: 'Flat',
      version: '1.0.0',
      input_schema: {},
      output_schema: {},
      verbs: [
        FETCH('get', { source: { type: 'http', config: {} } }),
        MAP('m', { expression: 'x' }),
        PERSIST('save', {
          sink: { type: 'sql', config: {} },
          mode: 'insert',
        }),
      ],
    });
    const flat = flatten(unit);
    assert.equal(flat.verbs.length, 3);
    assert.deepEqual(
      flat.verbs.map((v) => v.id),
      ['get', 'm', 'save'],
    );
  });
});
