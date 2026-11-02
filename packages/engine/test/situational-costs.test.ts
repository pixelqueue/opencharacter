import { describe, expect, it } from 'vitest';
import { applyChanges, buildRelease, loadRuleset } from '../src/index.ts';
import type { Change } from '../src/core/changes.ts';
import type { CharacterDoc } from '../src/core/pack-types.ts';

const loaded = loadRuleset([
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
        tags: ['damage', 'attack'],
        fields: {
          hp: { type: 'integer', input: true, default: 20, min: 0 },
          focus: { type: 'integer', input: true, default: 1, min: 0 },
        },
        situational: [
          {
            // Stops as much damage as the focus spent: braced at any level while there is focus.
            id: 'brace',
            type: 'integer',
            default: 0,
            incoming: { fields: ['hp'], tags: ['attack'] },
            available: 'focus > 0',
            effects: [
              {
                target: { incoming: { fields: ['hp'], tags: ['damage'] } },
                op: 'add',
                value: 'situational.brace',
              },
            ],
            changes: [{ type: 'adjust', field: 'focus', by: '-situational.brace' }],
          },
        ],
      } as never,
    ],
    content: [],
  }),
]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;
const character: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
};
const hit = (by: number, brace: number): Change =>
  ({
    type: 'adjust',
    field: 'test-pack:hp',
    by,
    tags: ['attack', 'damage'],
    situational: { 'test-pack:brace': brace },
  }) as Change;

describe("a situational choice's changes", () => {
  it('clamp like any adjust: a cost past the field minimum takes what is there', () => {
    const result = applyChanges(ruleset, character, [hit(-5, 3)]);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.character.values).toEqual({ 'test-pack:hp': 18, 'test-pack:focus': 0 });
    expect(result.adjustments.at(-1)).toEqual({
      field: 'test-pack:focus',
      by: -1,
      requested: -3,
      taken: -3,
      reason: 'requested',
      clamped: true,
      source: { type: 'situational', id: 'test-pack:brace' },
    });
  });

  it('charge one value per batch: the same value on two changes pays once', () => {
    const result = applyChanges(ruleset, { ...character, values: { 'test-pack:focus': 4 } }, [
      hit(-5, 2),
      hit(-4, 2),
    ]);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.character.values).toEqual({ 'test-pack:hp': 15, 'test-pack:focus': 2 });
  });

  it('reject different values for a choice with a cost in one batch', () => {
    const result = applyChanges(ruleset, { ...character, values: { 'test-pack:focus': 4 } }, [
      hit(-5, 2),
      hit(-4, 1),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      {
        code: 'situational-unavailable',
        path: '/changes/1',
        data: { situational: 'test-pack:brace' },
      },
    ]);
  });
});
