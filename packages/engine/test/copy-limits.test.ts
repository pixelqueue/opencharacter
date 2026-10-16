import { describe, expect, it } from 'vitest';
import { applyChanges, computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

const pack = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.1.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    contentTypes: {
      class: { copies: { max: 1 } },
      gear: { carried: true, copies: { max: 2, perItem: 1 } },
      trait: { copies: { max: 0 } },
      feat: {},
    },
    choices: [{ id: 'trait', pick: 1, required: false, from: { type: 'trait' } }],
    constraints: [{ id: 'never', check: 'false' }],
  },
  content: [
    { id: 'classes.a', type: 'class' },
    { id: 'classes.b', type: 'class' },
    { id: 'gear.rope', type: 'gear' },
    { id: 'gear.lamp', type: 'gear' },
    { id: 'traits.bold', type: 'trait' },
    { id: 'feats.tough', type: 'feat' },
  ],
} as unknown as PackRelease;

const loaded = loadRuleset([pack]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const base: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
};

describe('copy limits', () => {
  it('lists every limited type, in ruleset order, even with no copies', () => {
    expect(computeSheet(ruleset, base).copyLimits).toEqual([
      { type: 'test-pack:class', max: 1, count: 0, entries: [] },
      { type: 'test-pack:gear', max: 2, perItem: 1, count: 0, entries: [] },
      { type: 'test-pack:trait', max: 0, count: 0, entries: [] },
    ]);
  });

  it("counts copies, not quantity or picks, and reports each limit's data", () => {
    const character: CharacterDoc = {
      ...base,
      choices: { trait: [{ option: 'test-pack:traits.bold' }] },
      features: [
        { id: 'a', item: 'test-pack:classes.a' },
        { id: 'tough', item: 'test-pack:feats.tough' },
        { id: 'b', item: 'test-pack:classes.b' },
      ],
      inventory: [
        { id: 'rope', item: 'test-pack:gear.rope', quantity: 10 },
        { id: 'lamp', item: 'test-pack:gear.lamp' },
        { id: 'rope-2', item: 'test-pack:gear.rope' },
      ],
    };
    const sheet = computeSheet(ruleset, character);
    expect(sheet.copyLimits).toEqual([
      {
        type: 'test-pack:class',
        max: 1,
        count: 2,
        entries: [
          { entry: 'a', item: 'test-pack:classes.a' },
          { entry: 'b', item: 'test-pack:classes.b' },
        ],
      },
      {
        type: 'test-pack:gear',
        max: 2,
        perItem: 1,
        count: 3,
        entries: [
          { entry: 'rope', item: 'test-pack:gear.rope' },
          { entry: 'lamp', item: 'test-pack:gear.lamp' },
          { entry: 'rope-2', item: 'test-pack:gear.rope' },
        ],
      },
      { type: 'test-pack:trait', max: 0, count: 0, entries: [] },
    ]);
    // After the constraint, by type in ruleset order, a type's max before its items.
    expect(sheet.issues).toEqual([
      {
        code: 'constraint-failed',
        id: 'test-pack:never',
        source: { type: 'rules', id: 'test-pack:never' },
        data: {},
      },
      {
        code: 'too-many-copies',
        id: 'test-pack:class',
        source: { type: 'rules', id: 'test-pack:class' },
        data: { type: 'test-pack:class', max: 1, count: 2, entries: ['a', 'b'], limit: 1 },
      },
      {
        code: 'too-many-copies',
        id: 'test-pack:gear',
        source: { type: 'rules', id: 'test-pack:gear' },
        data: {
          type: 'test-pack:gear',
          max: 2,
          count: 3,
          entries: ['rope', 'lamp', 'rope-2'],
          limit: 2,
        },
      },
      {
        code: 'too-many-copies',
        id: 'test-pack:gear',
        source: { type: 'rules', id: 'test-pack:gear' },
        data: {
          type: 'test-pack:gear',
          item: 'test-pack:gear.rope',
          perItem: 1,
          count: 2,
          entries: ['rope', 'rope-2'],
          limit: 1,
        },
      },
    ]);
  });

  it('flags a copy of a type held by picks only (max 0)', () => {
    const character: CharacterDoc = {
      ...base,
      features: [{ id: 'bold', item: 'test-pack:traits.bold' }],
    };
    const codes = computeSheet(ruleset, character).issues.map((i) => `${i.code} ${i.id}`);
    expect(codes).toContain('too-many-copies test-pack:trait');
  });

  it('replaces a copy in one batch, reusing its ID, without an issue in strict mode', () => {
    const character: CharacterDoc = {
      ...base,
      features: [{ id: 'class', item: 'test-pack:classes.a' }],
    };
    const strictPack = loadRuleset([
      { ...pack, rules: { ...pack.rules, constraints: [] } } as unknown as PackRelease,
    ]);
    if (!strictPack.ok) throw new Error('load failed');
    const added = applyChanges(
      strictPack.ruleset,
      character,
      [{ type: 'addItem', entry: { id: 'class-2', item: 'test-pack:classes.b' } }],
      true,
    );
    expect(added.ok).toBe(false);
    const replaced = applyChanges(
      strictPack.ruleset,
      character,
      [
        { type: 'removeItem', entry: 'class' },
        { type: 'addItem', entry: { id: 'class', item: 'test-pack:classes.b' } },
      ],
      true,
    );
    expect(replaced.ok).toBe(true);
    if (replaced.ok) {
      expect(replaced.character.features).toEqual([{ id: 'class', item: 'test-pack:classes.b' }]);
      expect(replaced.issues).toEqual([]);
    }
  });
});
