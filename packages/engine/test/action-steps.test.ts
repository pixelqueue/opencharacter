import { describe, expect, it } from 'vitest';
import { loadRuleset, type PackRelease, startAction } from '../src/index.ts';

const release = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.1.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    tags: ['aim', 'outer', 'inner'],
    actions: [
      // A choice step and a roll step, each tagged only `aim`.
      {
        id: 'leaf',
        steps: [
          {
            id: 'stance',
            kind: 'choice',
            tags: ['aim'],
            options: [{ id: 'low' }, { id: 'high' }],
            recommend: "'low'",
          },
          { id: 'roll', kind: 'roll', parts: [{ dice: '1d6' }] },
          {
            id: 'done',
            kind: 'outcome',
            data: { stance: 'steps.stance.picked', total: 'steps.roll.total' },
          },
        ],
      },
      // Two levels: `outer` runs `middle` tagged `outer`, which runs `leaf` tagged `inner`.
      {
        id: 'middle',
        steps: [
          { id: 'leaf', kind: 'action', use: 'leaf', tags: ['inner'] },
          { id: 'done', kind: 'outcome', data: { total: 'steps.leaf.data.total' } },
        ],
      },
      {
        id: 'outer',
        steps: [
          { id: 'middle', kind: 'action', use: 'middle', tags: ['outer'] },
          { id: 'done', kind: 'outcome', data: { total: 'steps.middle.data.total' } },
        ],
      },
      // A handoff's `null` parameter is left out of what the participant runs.
      {
        id: 'ask',
        params: { bonus: { type: 'integer', optional: true } },
        participants: { helper: {} },
        steps: [
          {
            id: 'help',
            kind: 'action',
            each: 'helper',
            as: 'participant',
            use: 'leaf',
            params: { bonus: 'has(params.bonus) ? params.bonus : null' },
          },
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

describe('tags an action step adds', () => {
  it('reach the choice steps of the actions it runs in turn', () => {
    const result = startAction(ruleset, character as never, {
      action: { id: 'test-pack:outer' },
      // oxlint-disable-next-line unicorn/no-thenable
      policy: { rules: [{ kind: 'choice', tags: ['inner'], then: 'pause' }] },
    });
    expect(result).toMatchObject({ status: 'paused', needs: { step: 'middle/leaf/stance' } });
  });

  it('reach the roll steps too, by the outer tag', () => {
    const result = startAction(ruleset, character as never, {
      action: { id: 'test-pack:outer' },
      // oxlint-disable-next-line unicorn/no-thenable
      policy: { rules: [{ kind: 'roll', tags: ['outer'], then: 'pause' }] },
    });
    expect(result).toMatchObject({
      status: 'paused',
      needs: { step: 'middle/leaf/roll', kind: 'dice' },
    });
  });

  it("don't reach the steps of an action run without them", () => {
    const result = startAction(ruleset, character as never, {
      action: { id: 'test-pack:leaf' },
      // oxlint-disable-next-line unicorn/no-thenable
      policy: { rules: [{ kind: 'choice', tags: ['inner'], then: 'pause' }] },
    });
    expect(result).toMatchObject({ status: 'finished', outcome: { data: { stance: 'low' } } });
  });
});

describe('a handoff', () => {
  it('leaves a null parameter out of the run', () => {
    const result = startAction(ruleset, character as never, {
      action: { id: 'test-pack:ask' },
      participants: { helper: [{ id: 'h' }] },
    });
    expect(result).toMatchObject({
      status: 'paused',
      needs: { kind: 'handoff', run: { action: 'test-pack:leaf', params: {} } },
    });
  });
});

const strike = (passed: Record<string, string>) =>
  ({
    ...release,
    rules: {
      actions: [
        {
          id: 'defend',
          participants: { attacker: { max: 1 }, witness: {} },
          steps: [{ id: 'done', kind: 'outcome', data: { me: 'character.id' } }],
        },
        {
          id: 'strike',
          participants: { target: { max: 1 }, ally: {} },
          steps: [
            {
              id: 'defense',
              kind: 'action',
              each: 'target',
              as: 'participant',
              use: 'defend',
              participants: passed,
            },
          ],
        },
        {
          id: 'inline',
          participants: { target: { max: 1 } },
          steps: [
            {
              id: 'defense',
              kind: 'action',
              use: 'defend',
              participants: { attacker: '[character.id]' },
            },
          ],
        },
      ],
    },
  }) as unknown as PackRelease;
const run = (passed: Record<string, string>, action = 'strike') => {
  const r = loadRuleset([strike(passed)]);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return startAction(r.ruleset, character as never, {
    action: { id: `test-pack:${action}` },
    participants:
      action === 'strike' ? { target: [{ id: 't' }], ally: [{ id: 'a' }] } : { target: [] },
  });
};
const codes = (result: ReturnType<typeof run>) =>
  'errors' in result && result.errors ? result.errors.map((e) => e.code) : [];

describe("a handoff's participants", () => {
  it('lists the running character and the participants passed', () => {
    expect(run({ attacker: '[character.id]', witness: 'participants.ally' })).toMatchObject({
      status: 'paused',
      needs: { run: { participants: { attacker: ['c'], witness: ['a'] } } },
    });
  });

  it('checks them against the used action’s roles', () => {
    expect(codes(run({ helper: '[character.id]' }))).toEqual(['invalid-participants']);
    expect(codes(run({ attacker: '[character.id, participants.target[0].id]' }))).toEqual([
      'invalid-participants',
    ]);
    expect(codes(run({ attacker: '[character.id]', witness: '[character.id]' }))).toEqual([
      'duplicate-id',
    ]);
  });

  it('is only for handoffs: a nested action on the same character can’t take it', () => {
    expect(codes(run({}, 'inline'))).toEqual(['invalid-participants']);
  });

  it('binds `character.id` in every action', () => {
    const r = loadRuleset([strike({})]);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(
      startAction(r.ruleset, character as never, { action: { id: 'test-pack:defend' } }),
    ).toMatchObject({ status: 'finished', outcome: { data: { me: 'c' } } });
  });
});
