import { describe, expect, it } from 'vitest';
import { type CharacterDoc, loadRuleset, startAction } from '../src/index.ts';

const load = (path: unknown) =>
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
        contentTypes: { kit: { carried: true } },
        actions: [
          {
            id: 'fill',
            steps: [
              {
                id: 'picks',
                kind: 'choice',
                options: { pending: { path } },
                recommend: 'options[0]',
              },
              { id: 'done', kind: 'outcome', data: { picked: 'steps.picks.picked' } },
            ],
          },
        ],
      },
      content: [
        {
          id: 'kits.box',
          type: 'kit',
          choices: [
            { id: 'tool', from: { options: [{ id: 'saw' }, { id: 'hammer' }] } },
            { id: 'charm', from: { options: [{ id: 'bell' }] } },
          ],
        },
      ],
    } as never,
  ]);

const character: CharacterDoc = {
  specVersion: '0.2.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  inventory: [
    { id: 'box-1', item: 'test-pack:kits.box' },
    { id: 'box-2', item: 'test-pack:kits.box' },
  ],
};

const run = (path: unknown) => {
  const loaded = load(path);
  if (!loaded.ok) return loaded.errors.map((e) => e.code);
  return startAction(loaded.ruleset, character, { action: { id: 'test-pack:fill' } });
};

describe('a pending choice step with path', () => {
  it("asks only that copy's choices under the path", () => {
    expect(run({ entry: 'box-2', choice: ['charm'] })).toMatchObject({
      status: 'finished',
      outcome: { data: { picked: ['bell'] } },
      proposedChanges: [{ change: { path: { entry: 'box-2', choice: ['charm'] } } }],
    });
  });

  it('takes a computed entry and choice', () => {
    expect(run({ entry: { formula: "'box-1'" }, choice: "['tool']" })).toMatchObject({
      outcome: { data: { picked: ['saw'] } },
    });
  });

  it('asks no rules-level choice for a path with an entry, nor a copy choice without', () => {
    expect(run({ choice: ['tool'] })).toMatchObject({ outcome: { data: { picked: [] } } });
  });

  it('rejects a choice formula that is not a list of strings at load', () => {
    expect(run({ choice: '1 + 1' })).toEqual(['formula-error']);
  });
});
