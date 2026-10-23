import { describe, expect, it } from 'vitest';
import { type CharacterDoc, loadRuleset, startAction } from '../src/index.ts';

const load = (values: unknown, later: string) =>
  loadRuleset([
    {
      manifest: {
        id: 'test-pack',
        version: '1.0.0',
        specVersion: '0.2.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: {
        actions: [
          {
            id: 'pick',
            steps: [
              {
                id: 'picks',
                kind: 'choice',
                options: { values },
                repeat: { max: 2 },
                recommend: 'options[0]',
              },
              { id: 'done', kind: 'outcome', data: { out: later } },
            ],
          },
        ],
      },
      content: [],
    } as never,
  ]);

const character: CharacterDoc = {
  specVersion: '0.2.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
};

const run = (values: unknown, later: string) => {
  const loaded = load(values, later);
  if (!loaded.ok) return loaded.errors.map((e) => e.code);
  return startAction(loaded.ruleset, character, { action: { id: 'test-pack:pick' } });
};

describe("a repeated values step's values", () => {
  it('lists the picked values, numbers and strings as given', () => {
    expect(run([2, 'b'], 'steps.picks.values')).toMatchObject({
      outcome: { data: { out: [2, 2] } },
    });
    expect(run({ formula: "['b', 'c']" }, 'steps.picks.values')).toMatchObject({
      outcome: { data: { out: ['b', 'b'] } },
    });
  });

  it("types written values' elements at load", () => {
    expect(run([1, 2], 'sumList(steps.picks.values, x) + 1')).toMatchObject({
      outcome: { data: { out: 3 } },
    });
    expect(run([1, 2], "steps.picks.values[0] && 'x'")).toEqual(['formula-error']);
  });
});

describe("a values step's content", () => {
  const loaded = loadRuleset([
    {
      manifest: {
        id: 'test-pack',
        version: '1.0.0',
        specVersion: '0.2.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: {
        contentTypes: { spell: { actions: [{ use: 'cast' }] } },
        actions: [
          {
            id: 'cast',
            steps: [
              { id: 'option', kind: 'choice', options: { values: ['a', 'b'] }, random: 'true' },
            ],
          },
          {
            id: 'plain',
            steps: [{ id: 'option', kind: 'choice', options: { values: ['a', 'b'] } }],
          },
        ],
      },
      content: [{ id: 'spells.hex', type: 'spell' }],
    } as never,
  ]);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  const caster: CharacterDoc = {
    ...character,
    features: [{ id: 'hex', item: 'test-pack:spells.hex' }],
  };

  it("is on a random draw's pause, and absent for an action without content", () => {
    const drawn = startAction(loaded.ruleset, caster, {
      action: { id: 'test-pack:cast', entry: 'hex' },
      policy: { dice: 'pause' },
    });
    expect(drawn).toMatchObject({
      needs: { kind: 'dice', draw: { among: ['a', 'b'] }, content: 'test-pack:spells.hex' },
    });
    const plain = startAction(loaded.ruleset, caster, { action: { id: 'test-pack:plain' } });
    expect(plain).toMatchObject({ needs: { kind: 'choice' } });
    expect((plain as { needs: object }).needs).not.toHaveProperty('content');
  });
});
