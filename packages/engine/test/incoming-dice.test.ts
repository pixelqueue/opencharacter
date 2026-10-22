import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyChanges, buildRelease, diceFrom, loadRuleset } from '../src/index.ts';
import type { Change } from '../src/core/changes.ts';
import type { CharacterDoc } from '../src/core/pack-types.ts';
import { readPack } from './packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const loaded = loadRuleset([readPack(`${root}packs/mork-borg/core`)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const HP = 'mork-borg-core:hp.current';
const character: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'mork-borg-core', version: '0.1.1' }],
  values: { 'mork-borg-core:hp.max': 10, [HP]: 8 },
  inventory: [
    { id: 'worn', item: 'mork-borg-core:armor.heavy', equipped: true, state: { damage: 0 } },
    {
      id: 'shield',
      item: 'mork-borg-core:shields.shield',
      equipped: true,
      state: { broken: false },
    },
  ],
};
const hit = (by: number, faces?: number[]): Change =>
  ({ type: 'adjust', field: HP, by, tags: ['damage'], ...(faces ? { faces } : {}) }) as Change;

describe('dice on incoming changes', () => {
  it('lists the dice to roll in faces-required', () => {
    const result = applyChanges(ruleset, character, [hit(-1), hit(-7)]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      {
        code: 'faces-required',
        path: '/changes/0',
        data: {
          dice: [
            {
              source: {
                type: 'item',
                id: 'mork-borg-core:armor.heavy',
                entry: 'worn',
                effect: 'armor-die',
              },
              dice: '1d6',
            },
          ],
          supplied: 0,
        },
      },
    ]);
  });

  it('reports the counts in faces-mismatch', () => {
    const result = applyChanges(ruleset, character, [hit(-7, [3, 4, 5])]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      code: 'faces-mismatch',
      data: { supplied: 3, used: 1 },
    });
  });

  it('takes the given faces first, then the dice function', () => {
    const result = applyChanges(
      ruleset,
      character,
      [hit(-9, [5]), hit(-9)],
      false,
      {},
      diceFrom([2]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changes).toEqual([hit(-9, [5]), hit(-9, [2])]);
    // -9 + 5 + 1 = -3, then -9 + 2 + 1 = -6.
    expect(result.character.values?.[HP]).toBe(-1);
  });

  it('replays its output changes to the same character without a dice function', () => {
    let rolls = 0;
    const counting = (count: number) => {
      rolls += count;
      return Array.from({ length: count }, () => 4);
    };
    const first = applyChanges(ruleset, character, [hit(-6), hit(-2)], false, {}, counting);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(rolls).toBe(2);
    const replay = applyChanges(ruleset, character, first.changes);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.character).toEqual(first.character);
    expect(replay.changes).toEqual(first.changes);
    expect(replay.adjustments).toEqual(first.adjustments);
  });

  it('returns a batch that rolled nothing unchanged', () => {
    const changes = [{ type: 'adjust', field: HP, by: 1, tags: ['healing'] }] as Change[];
    const result = applyChanges(ruleset, character, changes);
    expect(result.ok && result.changes).toEqual(changes);
  });
});

const load = (op: string, value: string) =>
  loadRuleset([
    buildRelease({
      manifest: {
        id: 'test-pack',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: [
        {
          fields: { hp: { type: 'integer', input: true, default: 5 } },
          effects: [{ target: { incoming: { fields: ['hp'] } }, op, value }],
        },
      ],
      content: [],
    }),
  ]);

describe('type-checking incoming dice', () => {
  it('accepts dice in add', () => {
    expect(load('add', '1d4').ok).toBe(true);
  });

  it('rejects dice in multiply, set, atLeast and atMost', () => {
    for (const op of ['multiply', 'set', 'atLeast', 'atMost']) {
      const result = load(op, '1d4');
      expect(result.ok, op).toBe(false);
      if (result.ok) continue;
      expect(result.errors[0]).toMatchObject({
        code: 'formula-error',
        data: { cause: 'type-mismatch' },
      });
    }
  });
});
