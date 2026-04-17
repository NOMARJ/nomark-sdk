import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FETCH,
  MAP,
  PERSIST,
  DISPLAY,
  ARRANGE,
  isVerb,
  verb,
  VERB_REGISTRY,
  VERB_BY_NAME,
  VERB_BY_ID,
  COMPUTATION_VERBS,
  SURFACE_VERBS,
  classifyVerb,
} from '../src/index.js';

describe('verb builders', () => {
  it('builds a FETCH instance with the correct shape', () => {
    const f = FETCH('extract', {
      source: { type: 'sql', config: { query: 'SELECT 1' } },
    });
    assert.equal(f.id, 'extract');
    assert.equal(f.verb, 'FETCH');
    assert.ok(isVerb(f));
  });

  it('carries entity and next options through', () => {
    const p = PERSIST(
      'write',
      {
        sink: { type: 'sql', config: { table: 't' } },
        mode: 'insert',
      },
      { entity: 'trade', next: 'notify' },
    );
    assert.equal(p.entity, 'trade');
    assert.equal(p.next, 'notify');
  });

  it('rejects missing or empty id', () => {
    assert.throws(
      () =>
        MAP('', {
          expression: 'row.x',
        }),
      /non-empty string/,
    );
  });

  it('rejects non-object params', () => {
    assert.throws(
      // @ts-expect-error - intentionally wrong for the runtime check
      () => FETCH('x', null),
      /must be an object/,
    );
  });

  it('dynamic verb() builder round-trips', () => {
    const a = verb('DISPLAY', 'metric', { type: 'metric', data: 'x' });
    const b = DISPLAY('metric', { type: 'metric', data: 'x' });
    assert.deepEqual(a, b);
  });

  it('ARRANGE children are ids (strings)', () => {
    const layout = ARRANGE('root', {
      type: 'grid',
      children: ['a', 'b', 'c'],
    });
    assert.deepEqual(layout.params.children, ['a', 'b', 'c']);
  });
});

describe('registry', () => {
  it('contains all 31 verbs', () => {
    assert.equal(VERB_REGISTRY.length, 31);
  });

  it('has unique semantic ids', () => {
    const ids = new Set(VERB_REGISTRY.map((e) => e.id));
    assert.equal(ids.size, 31);
  });

  it('has 20 computation verbs and 11 surface verbs', () => {
    assert.equal(COMPUTATION_VERBS.length, 20);
    assert.equal(SURFACE_VERBS.length, 11);
  });

  it('looks up by name and id', () => {
    assert.equal(VERB_BY_NAME.get('FETCH')?.id, '0x01');
    assert.equal(VERB_BY_ID.get('0x1F')?.canonical, 'GUIDE');
  });

  it('classifies verbs correctly', () => {
    assert.equal(classifyVerb('FETCH'), 'computation');
    assert.equal(classifyVerb('DISPLAY'), 'surface');
    assert.equal(classifyVerb('COMPOSE'), 'grammar');
  });
});
