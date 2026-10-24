import { describe, expect, it } from 'vitest';
import { applyChanges, computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

const manifest = (id: string, dependencies?: Record<string, string>) => ({
  id,
  version: '1.0.0',
  specVersion: '0.2.0',
  license: 'CC0-1.0',
  defaultLanguage: 'en',
  ...(dependencies ? { dependencies } : {}),
});

const core = {
  manifest: manifest('core'),
  rules: {
    fields: { rank: { type: 'integer', formula: 0 } },
    contentTypes: { class: {}, feature: { grantOnly: true } },
    choices: [{ id: 'boon', pick: 1, required: false, from: { type: 'feature' } }],
  },
  content: [
    {
      id: 'classes.knight',
      type: 'class',
      grants: [{ item: 'features.oath' }],
    },
    { id: 'features.oath', type: 'feature', effects: [{ target: 'rank', op: 'add', value: 1 }] },
    { id: 'features.vigil', type: 'feature', effects: [{ target: 'rank', op: 'add', value: 10 }] },
    { id: 'features.squire', extends: 'features.oath' },
  ],
} as unknown as PackRelease;

const addon = {
  manifest: manifest('addon', { core: '^1.0.0' }),
  rules: {},
  content: [
    { override: 'core:features.vigil', grantOnly: false },
    { override: 'core:classes.knight', grantOnly: true },
  ],
} as unknown as PackRelease;

const load = (packs: PackRelease[]) => {
  const loaded = loadRuleset(packs);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  return loaded.ruleset;
};

const base: CharacterDoc = {
  specVersion: '0.2.0',
  id: 'test',
  packs: [{ id: 'core', version: '1.0.0' }],
};

const add = (item: string) => [{ type: 'addItem' as const, entry: { id: 'x', item } }];

describe('grant-only content', () => {
  it('refuses addItem with the item in the error', () => {
    const result = applyChanges(load([core]), base, add('core:features.oath'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      { code: 'not-addable', path: '/changes/0', data: { item: 'core:features.oath' } },
    ]);
  });

  it('marks loaded items by their type, inherited through extends', () => {
    const ruleset = load([core]);
    expect(ruleset.content['core:features.squire']?.grantOnly).toBe(true);
    expect(ruleset.content['core:classes.knight']?.grantOnly).toBeUndefined();
    expect(ruleset.contentTypes['core:feature']?.grantOnly).toBe(true);
  });

  it("follows an override's grantOnly", () => {
    const ruleset = load([core, addon]);
    const pins = { ...base, packs: [...base.packs, { id: 'addon', version: '1.0.0' }] };
    expect(applyChanges(ruleset, pins, add('core:features.vigil')).ok).toBe(true);
    expect(applyChanges(ruleset, pins, add('core:classes.knight')).ok).toBe(false);
  });

  it('still grants and picks it', () => {
    const ruleset = load([core]);
    const character: CharacterDoc = {
      ...base,
      choices: { boon: [{ option: 'core:features.vigil' }] },
      features: [{ id: 'knight', item: 'core:classes.knight' }],
    };
    expect(computeSheet(ruleset, character).values['core:rank']?.value).toBe(11);
    expect(
      applyChanges(ruleset, base, [
        { type: 'choose', path: { choice: ['boon'] }, option: 'core:features.vigil' },
      ]).ok,
    ).toBe(true);
  });

  it('keeps a saved copy of a grant-only item on the sheet', () => {
    const character: CharacterDoc = {
      ...base,
      features: [{ id: 'oath', item: 'core:features.oath' }],
    };
    const sheet = computeSheet(load([core]), character);
    expect(sheet.errors).toEqual([]);
    expect(sheet.values['core:rank']?.value).toBe(1);
  });
});
