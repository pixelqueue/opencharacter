import { resolve } from 'node:path';
import { paths } from '@opencharacter/spec/node';
import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset, type CharacterDoc } from '../src/index.ts';
import { readPack } from './packs.ts';

const loaded = loadRuleset([readPack(resolve(paths.tests, 'packs/test-span-stacking'))]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const kits = (...items: string[]): CharacterDoc => ({
  specVersion: '0.1.0',
  id: 'kits',
  packs: [{ id: 'test-span-stacking', version: '0.1.0' }],
  features: items.map((item) => ({ id: item, item: `test-span-stacking:kits.${item}` })),
});
const value = (sheet: ReturnType<typeof computeSheet>, field: string) =>
  sheet.values[`test-span-stacking:kit.${field}`]?.value;

describe('stack keys spanning fields', () => {
  it('leaves a single-field playerChooses group as it was: no fields, no values', () => {
    const sheet = computeSheet(ruleset, kits('martial-artist', 'mountain'));
    const group = sheet.competing.find((c) => c.stackKey === 'kit-stability');
    expect(group?.field).toBe('test-span-stacking:kit.stability');
    expect(group).not.toHaveProperty('fields');
    expect(group?.options.every((o) => !('values' in o))).toBe(true);
    // Picking the other option works per field, as before.
    const picked = computeSheet(ruleset, kits('martial-artist', 'mountain'), [
      'test-span-stacking:kits.martial-artist#type.8',
    ]);
    expect(value(picked, 'stability')).toBe(1);
  });

  it('keeps one source on every field, never the best per field', () => {
    const sheet = computeSheet(ruleset, kits('martial-artist', 'mountain'));
    expect(['melee1', 'melee2', 'melee3'].map((f) => value(sheet, f))).toEqual([2, 2, 2]);
    expect(sheet.competing.filter((c) => c.stackKey === 'kit-melee')).toHaveLength(1);
    // highestOnly spanning: Mountain's guard 3 beats Martial Artist's guard 1 + ward 1.
    expect([value(sheet, 'guard'), value(sheet, 'ward')]).toEqual([13, 10]);
  });

  it('reports the group once, whichever field is read first', () => {
    const sheet = computeSheet(ruleset, kits('mountain', 'martial-artist'));
    const melee = sheet.competing.filter((c) => c.stackKey === 'kit-melee');
    expect(melee).toHaveLength(1);
    // Options follow instance order: Mountain's copy comes first now.
    expect(melee[0]?.options.map((o) => o.id)).toEqual([
      'test-span-stacking:kits.mountain#type.0',
      'test-span-stacking:kits.martial-artist#type.0',
    ]);
    expect(melee[0]?.recommended).toBe('test-span-stacking:kits.martial-artist#type.0');
  });

  it("isn't failed by another field's failing tags, and decides a failing group once", () => {
    const pack = {
      manifest: {
        id: 'p',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: {
        tags: ['x', 'y'],
        settings: {
          stacking: { keys: { melee: { policy: 'playerChooses', spansFields: true } } },
        },
        fields: {
          zero: { type: 'integer', input: true, default: 0 },
          melee1: { type: 'integer', formula: 0 },
          melee2: { type: 'integer', formula: 0 },
          // Its computed tag divides by zero, so an effect on a set of fields can't tell whether
          // it reaches it: the field fails, not the melee group.
          odd: { type: 'integer', formula: 0, tags: [{ formula: "1 / zero > 0 ? 'x' : 'y'" }] },
        },
        contentTypes: { kit: { fields: { m1: { type: 'integer' }, m2: { type: 'integer' } } } },
        effects: [{ target: { fields: { where: "'x' in item.tags" } }, op: 'add', value: 1 }],
      },
      content: [
        {
          id: 'kits.a',
          type: 'kit',
          fields: { m1: 2, m2: 2 },
          effects: [
            { target: 'melee1', op: 'add', value: 'item.m1', stackKey: 'melee' },
            { target: 'melee2', op: 'add', value: 'item.m2', stackKey: 'melee' },
          ],
        },
        {
          id: 'kits.b',
          type: 'kit',
          fields: { m1: 0, m2: 4 },
          effects: [
            { target: 'melee1', op: 'add', value: 'item.m1', stackKey: 'melee' },
            { target: 'melee2', op: 'add', value: 'item.m2', stackKey: 'melee' },
          ],
        },
      ],
    };
    const built = loadRuleset([pack as never]);
    if (!built.ok) throw new Error(JSON.stringify(built.errors));
    const doc: CharacterDoc = {
      specVersion: '0.1.0',
      id: 'c',
      packs: [{ id: 'p', version: '1.0.0' }],
      features: [
        { id: 'a', item: 'p:kits.a' },
        { id: 'b', item: 'p:kits.b' },
      ],
    };
    const sheet = computeSheet(built.ruleset, doc);
    expect(sheet.values['p:odd']?.error).toBeDefined();
    expect([sheet.values['p:melee1']?.value, sheet.values['p:melee2']?.value]).toEqual([2, 2]);
    expect(sheet.competing.filter((c) => c.stackKey === 'melee')).toHaveLength(1);
  });

  it('suppresses the other sources on every field', () => {
    const sheet = computeSheet(ruleset, kits('martial-artist', 'mountain'));
    const suppressed = sheet.effects
      .filter((e) => e.suppressed && e.source.id === 'test-span-stacking:kits.mountain')
      .map((e) => e.target);
    expect(suppressed).toEqual(
      expect.arrayContaining([
        'test-span-stacking:kit.melee1',
        'test-span-stacking:kit.melee2',
        'test-span-stacking:kit.melee3',
      ]),
    );
  });
});
