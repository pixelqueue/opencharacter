import { describe, expect, it } from 'vitest';
import { diceFrom, loadRuleset, type PackRelease, startAction } from '../src/index.ts';

const release = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.1.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    fields: {
      trained: { type: 'set', of: 'string', default: ['skill.stealth', 'skill.arcana'] },
      memory: { type: 'string', input: true, default: '' },
    },
    actions: [
      {
        id: 'memory',
        steps: [
          {
            id: 'skill',
            kind: 'choice',
            options: { values: { formula: 'trained' } },
            recommend: 'options[0]',
            changes: [{ type: 'set', field: 'memory', value: 'picked.value' }],
          },
        ],
      },
      {
        id: 'twice',
        steps: [
          {
            id: 'pick',
            kind: 'choice',
            options: { values: ['a', 'b', 'c'], where: 'picks == 0' },
            repeat: { max: 2 },
            recommend: 'options[size(options) - 1]',
          },
          { id: 'done', kind: 'outcome', data: { picked: 'steps.pick.picked' } },
        ],
      },
      {
        id: 'bad',
        steps: [
          { id: 'set', kind: 'branch', cases: [{ when: 'true', flags: { list: '[true]' } }] },
          { id: 'pick', kind: 'choice', options: { values: { formula: 'flags.list' } } },
        ],
      },
      {
        id: 'random',
        steps: [
          {
            id: 'pick',
            kind: 'choice',
            options: { values: [4, 6, 8] },
            random: 'true',
          },
          { id: 'done', kind: 'outcome', data: { die: 'steps.pick.value' } },
        ],
      },
    ],
  },
  content: [],
} as unknown as PackRelease;

const loaded = loadRuleset([release]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;
const character = { specVersion: '0.1.0', id: 'c', packs: [{ id: 'test-pack', version: '1.0.0' }] };

describe('a choice step over values', () => {
  it('offers what a list field holds and proposes `picked.value`', () => {
    const result = startAction(ruleset, character as never, { action: { id: 'test-pack:memory' } });
    expect(result).toMatchObject({
      status: 'finished',
      proposedChanges: [
        { change: { type: 'set', field: 'test-pack:memory', value: 'skill.arcana' } },
      ],
    });
  });

  it('works the options out again before each repeated pick', () => {
    const result = startAction(ruleset, character as never, { action: { id: 'test-pack:twice' } });
    expect(result).toMatchObject({ status: 'finished', outcome: { data: { picked: ['c', 'b'] } } });
  });

  it('draws among the values, keeping a number a number', () => {
    const result = startAction(
      ruleset,
      character as never,
      { action: { id: 'test-pack:random' } },
      diceFrom([2]),
    );
    expect(result).toMatchObject({ status: 'finished', outcome: { data: { die: 6 } } });
  });

  it('rejects a list element that is neither a string nor a number', () => {
    const result = startAction(ruleset, character as never, { action: { id: 'test-pack:bad' } });
    expect(result).toMatchObject({ errors: [{ code: 'type-mismatch' }] });
  });
});
