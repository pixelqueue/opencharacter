import { describe, expect, it } from 'vitest';
import { applyChanges, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

// An incoming-change effect's `then` on picked or held granted content changes the state its
// `self` reads: the pick's, or the grant's saved state, for keys that content declares.

const soak = (key: string) => ({
  id: 'soak',
  target: { incoming: { fields: ['hp'], tags: ['damage'] } },
  op: 'add',
  value: 1,
  when: `self.${key} > 0 && incoming.amount < 0`,
  // oxlint-disable-next-line unicorn/no-thenable
  then: [{ type: 'adjustState', entry: 'self', key, by: -1 }],
});

const loaded = loadRuleset([
  {
    manifest: {
      id: 'test-pack',
      version: '1.0.0',
      specVersion: '0.1.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: {
      tags: ['damage'],
      choices: [{ id: 'boon', from: { type: 'talent' } }],
      fields: { hp: { type: 'integer', input: true, default: 20, min: 0, max: 20 } },
      contentTypes: {
        feature: { state: { worn: { type: 'boolean', default: true } } },
        ward: {
          state: { charges: { type: 'integer', default: 2, min: 0 } },
          effects: [soak('charges')],
        },
        talent: {
          state: { uses: { type: 'integer', default: 1, min: 0 } },
          effects: [soak('uses')],
        },
      },
    },
    content: [
      { id: 'wards.ward', type: 'ward' },
      { id: 'talents.tough', type: 'talent' },
      // Two grants of one ward share its saved state.
      {
        id: 'features.twice',
        type: 'feature',
        grants: [{ item: 'wards.ward' }, { item: 'wards.ward' }],
      },
      // Its own effect, earlier in instance order, turns the ward's grant off.
      {
        id: 'features.fragile',
        type: 'feature',
        grants: [{ item: 'wards.ward', when: 'self.worn' }],
        effects: [
          {
            id: 'break',
            target: { incoming: { fields: ['hp'], tags: ['damage'] } },
            op: 'add',
            value: 0,
            // oxlint-disable-next-line unicorn/no-thenable
            then: [{ type: 'setState', entry: 'self', key: 'worn', value: false }],
          },
        ],
      },
      // A picked talent that grants the ward: the grant keeps its state on the pick.
      {
        id: 'talents.warded',
        type: 'talent',
        grants: [{ item: 'wards.ward' }],
      },
      {
        id: 'features.path',
        type: 'feature',
        choices: [{ id: 'talent', from: { type: 'talent' } }],
      },
    ],
  } as unknown as PackRelease,
]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const base: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
};
const hit = [{ type: 'adjust', field: 'test-pack:hp', by: -3, tags: ['damage'] }] as never;

describe('`then` on content with its own state', () => {
  it('two grants of one item on one owner change their one saved state', () => {
    const result = applyChanges(
      ruleset,
      { ...base, features: [{ id: 'f', item: 'test-pack:features.twice' }] },
      hit,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    // Both instances count, and each spends a charge from the one saved state: 2, 1, 0.
    expect(result.character.values?.['test-pack:hp']).toBe(19);
    expect(result.character.features?.[0]?.grants).toEqual({
      'test-pack:wards.ward': { state: { charges: 0 } },
    });
    expect(
      result.adjustments.filter((a) => 'key' in a).map((a) => (a as { value: unknown }).value),
    ).toEqual([1, 0]);
  });

  it('skips a change to a grant an earlier `then` turned off', () => {
    const result = applyChanges(
      ruleset,
      { ...base, features: [{ id: 'f', item: 'test-pack:features.fragile' }] },
      hit,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.character.features?.[0]).toEqual({
      id: 'f',
      item: 'test-pack:features.fragile',
      state: { worn: false },
    });
    expect(result.adjustments.filter((a) => 'key' in a)).toEqual([
      {
        entry: 'f',
        key: 'worn',
        value: false,
        source: { type: 'item', id: 'test-pack:features.fragile', entry: 'f', effect: 'break' },
      },
    ]);
  });

  it('writes the grant state of content granted by a pick on that pick', () => {
    const result = applyChanges(
      ruleset,
      {
        ...base,
        features: [
          {
            id: 'f',
            item: 'test-pack:features.path',
            choices: { talent: [{ option: 'test-pack:talents.warded', state: { uses: 0 } }] },
          },
        ],
      },
      hit,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.character.features?.[0]?.choices).toEqual({
      talent: [
        {
          option: 'test-pack:talents.warded',
          state: { uses: 0 },
          grants: { 'test-pack:wards.ward': { state: { charges: 1 } } },
        },
      ],
    });
    expect(result.adjustments.filter((a) => 'key' in a)).toEqual([
      {
        path: { entry: 'f', choice: ['talent'] },
        option: 'test-pack:talents.warded',
        grant: 'test-pack:wards.ward',
        key: 'charges',
        value: 1,
        source: { type: 'item', id: 'test-pack:wards.ward', entry: 'f', effect: 'soak' },
      },
    ]);
  });

  it('writes the pick state of content picked in a rules-level choice', () => {
    const result = applyChanges(
      ruleset,
      { ...base, choices: { boon: [{ option: 'test-pack:talents.tough' }] } },
      hit,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.character.choices).toEqual({
      boon: [{ option: 'test-pack:talents.tough', state: { uses: 0 } }],
    });
    expect(result.adjustments.filter((a) => 'key' in a)).toEqual([
      {
        path: { choice: ['boon'] },
        option: 'test-pack:talents.tough',
        key: 'uses',
        value: 0,
        source: { type: 'item', id: 'test-pack:talents.tough', effect: 'soak' },
      },
    ]);
  });
});
