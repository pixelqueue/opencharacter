import { describe, expect, it } from 'vitest';
import { loadSchemas } from '../../../packages/spec/src/node.ts';
import {
  diff,
  initial,
  kindOf,
  properties,
  Registry,
  variantFor,
  variants,
} from '../src/schema.ts';

const reg = new Registry(Object.fromEntries([...loadSchemas().values()].map((s) => [s.$id, s])));
const BASE = 'https://opencharacterformat.org/schemas/0.2/';
const effect = reg.doc(`${BASE}effect.schema.json`);

describe('schema forms', () => {
  it('resolves $refs across schema files and marks formulas', () => {
    const when = properties(reg, effect, {}).find((p) => p.name === 'when');
    expect(when && kindOf(when.at)).toBe('formula');
    const op = properties(reg, effect, {}).find((p) => p.name === 'op');
    expect(op && kindOf(op.at)).toBe('enum');
  });

  it('applies if/then: an effect value is a formula, a grant object or a roll modifier by op', () => {
    const value = (v: Record<string, unknown>) =>
      properties(reg, effect, v).find((p) => p.name === 'value')?.at;
    expect(kindOf(value({ op: 'add' }) as never)).toBe('formula');
    const grant = value({ op: 'grant' });
    expect(grant && properties(reg, grant, {}).map((p) => p.name)).toEqual([
      'item',
      'tag',
      'field',
      'query',
      'formula',
    ]);
    const modifier = value({ op: 'rollModifier' });
    expect(modifier && properties(reg, modifier, {}).map((p) => p.name)).toContain('kind');
  });

  it('picks the union variant a value belongs to', () => {
    const target = properties(reg, effect, {}).find((p) => p.name === 'target')?.at;
    if (!target) throw new Error('no target');
    expect(kindOf(target)).toBe('union');
    expect(variantFor(reg, target, 'combat.ac')).toBe(0); // a field ID
    expect(variantFor(reg, target, '5e-srd-5.1:combat.ac')).toBe(1); // a qualified field ID
    expect(variantFor(reg, target, { rolls: ['attack'] })).toBe(2);
    expect(variantFor(reg, target, { incoming: { tags: ['damage.fire'] } })).toBe(3);
    expect(variantFor(reg, target, { choices: ['push-cost'] })).toBe(4);
    expect(variantFor(reg, target, { steps: ['strike.hit'] })).toBe(5);
    expect(variantFor(reg, target, { fields: { where: "'save' in item.tags" } })).toBe(6);
    // fieldRef is flattened into the list: seven choices, one dropdown.
    expect(variants(reg, target).length).toBe(7);
  });

  it('treats an object with a oneOf constraint as an object (content items)', () => {
    const item = reg.doc(`${BASE}content-item.schema.json`);
    expect(kindOf(item)).toBe('object');
    expect(properties(reg, item, {}).map((p) => p.name)).toEqual(
      expect.arrayContaining(['effects', 'actions', 'choices', 'grants']),
    );
  });

  it('starts new values with their required properties', () => {
    expect(initial(reg, effect)).toEqual({ target: '', op: 'add' });
  });

  it('diffs into minimal ops, keeping keys with dots whole', () => {
    const before = { fields: { 'abilities.str.score': { default: 10, min: 1 } }, tags: ['a'] };
    const after = { fields: { 'abilities.str.score': { default: 11, min: 1 } }, tags: ['a', 'b'] };
    expect(diff(before, after)).toEqual([
      { path: ['fields', 'abilities.str.score', 'default'], value: 11 },
      { path: ['tags'], value: ['a', 'b'] },
    ]);
    expect(diff({ a: 1, b: 2 }, { a: 1 })).toEqual([{ path: ['b'], delete: true }]);
  });
});
