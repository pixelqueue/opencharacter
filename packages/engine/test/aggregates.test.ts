// The aggregates' dependency helpers. Their formula behavior is in the spec's formula cases
// (aggregate-fields.yaml, lists.yaml, copies.yaml).

import { describe, expect, it } from 'vitest';
import * as f from '../src/formula/index.ts';

function tree(text: string): f.Node {
  const result = f.parse(text);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

const FIELDS: f.FieldView[] = [
  { id: 'p:skills.fight', type: 'integer', tags: ['skill'] },
  { id: 'p:skills.will', type: 'integer', tags: ['skill'] },
  { id: 'p:skills.cap', type: 'integer', tags: [] },
];

describe('references', () => {
  it('skips the aggregate roots inside their arguments', () => {
    const names = f.references(
      tree("sumFields(f.value, 'skill' in f.tags) + countCopies(copy.quantity > cap) + bonus"),
      new Set(),
    );
    expect([...names].toSorted()).toEqual(['bonus', 'cap']);
  });

  it('skips copy inside maxCopies and minCopies', () => {
    const names = f.references(
      tree('maxCopies(copy.fields.armor, copy.type == kind) - minCopies(copy.quantity) + bonus'),
      new Set(),
    );
    expect([...names].toSorted()).toEqual(['bonus', 'kind']);
  });

  it("keeps a list function's list argument outside the root", () => {
    const names = f.references(tree('countList(x.rolls, x.result == want)'), new Set());
    expect([...names].toSorted()).toEqual(['want', 'x.rolls']);
  });
});

describe('aggregatedFields', () => {
  it('reads the fields the static filter keeps', () => {
    const read = f.aggregatedFields(tree("maxFields(f.value, 'skill' in f.tags)"), FIELDS);
    expect([...read]).toEqual(['p:skills.fight', 'p:skills.will']);
  });

  it('reads every field without a filter', () => {
    expect(f.aggregatedFields(tree('sumFields(1)'), FIELDS).size).toBe(3);
  });

  it('reads nothing for countFields', () => {
    expect(f.aggregatedFields(tree('countFields(true)'), FIELDS).size).toBe(0);
  });

  it('reads nothing for a filter that is not static', () => {
    expect(f.aggregatedFields(tree('sumFields(f.value, f.value > 0)'), FIELDS).size).toBe(0);
  });
});

describe('keptFields', () => {
  it('works a filter out once per field list', () => {
    const cond = tree("'skill' in f.tags");
    const first = f.keptFields('countFields', cond, FIELDS);
    expect(first.map((v) => v.id)).toEqual(['p:skills.fight', 'p:skills.will']);
    expect(f.keptFields('countFields', cond, FIELDS)).toBe(first);
  });
});
