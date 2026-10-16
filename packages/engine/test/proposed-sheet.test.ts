import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from '@opencharacter/spec/node';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { continueAction, loadRuleset, type PackRelease, startAction } from '../src/index.ts';

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
      health: { type: 'integer', input: true, default: 0 },
      luck: { type: 'integer', input: true, default: 0 },
    },
    actions: [
      {
        id: 'mixed',
        participants: { target: {} },
        steps: [
          // Only `to: self` changes are applied, not the target's; each pick of `pick` sees the
          // luck the earlier picks proposed.
          {
            id: 'hurt',
            kind: 'changes',
            to: 'target',
            changes: [{ type: 'set', field: 'health', value: 9 }],
          },
          { id: 'heal', kind: 'changes', changes: [{ type: 'adjust', field: 'health', by: 2 }] },
          {
            id: 'pick',
            kind: 'choice',
            sheet: 'proposed',
            options: [{ id: 'lucky', changes: [{ type: 'adjust', field: 'luck', by: 1 }] }],
            repeat: { max: 3 },
            recommend: "luck < 2 ? 'lucky' : ''",
          },
          {
            id: 'done',
            kind: 'outcome',
            sheet: 'proposed',
            data: { health: 'health', luck: 'luck', picks: 'size(steps.pick.picked)' },
          },
        ],
      },
      {
        id: 'broken',
        steps: [
          { id: 'ok', kind: 'changes', changes: [{ type: 'set', field: 'luck', value: 1 }] },
          {
            id: 'bad',
            kind: 'changes',
            changes: [{ type: 'choose', path: { entry: 'ghost', choice: ['x'] }, option: "'y'" }],
          },
          {
            id: 'branch',
            kind: 'branch',
            cases: [
              {
                when: 'true',
                steps: [{ id: 'read', kind: 'outcome', sheet: 'proposed', data: { luck: 'luck' } }],
              },
            ],
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

describe('the proposed sheet', () => {
  it("applies only the action's own changes, again before each pick", () => {
    const result = startAction(ruleset, character as never, {
      action: { id: 'test-pack:mixed' },
      participants: { target: [{ id: 't' }] },
    });
    // The recommendation reads the luck proposed by earlier picks: two picks, then none.
    expect(result).toMatchObject({
      status: 'paused',
      needs: { step: 'pick', options: ['lucky', '#done'] },
    });
    if (!('status' in result) || result.status !== 'paused') return;
    expect(result.log.map((e) => e.option)).toEqual(['lucky', 'lucky']);
    // The target's health isn't applied to the actor's sheet.
    const done = continueAction(ruleset, result, { option: '#done' });
    expect(done).toMatchObject({
      status: 'finished',
      outcome: { data: { health: 2, luck: 2, picks: 2 } },
    });
  });

  it('fails with the step path and the batch error', () => {
    const result = startAction(ruleset, character as never, { action: { id: 'test-pack:broken' } });
    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: 'proposed-changes-failed',
          data: { step: 'branch/read', error: { path: '/changes/1' } },
        },
      ],
    });
  });
});

const pendingCase = parse(
  readFileSync(join(paths.tests, 'cases/actions/choice-pending-pause/case.yaml'), 'utf8'),
);
const pendingLoaded = loadRuleset([pendingCase.packs[0].inline as PackRelease]);
if (!pendingLoaded.ok) throw new Error(JSON.stringify(pendingLoaded.errors));

describe('choice steps over pending choices', () => {
  const input = {
    action: { id: 'test-pack:create' },
    // oxlint-disable-next-line unicorn/no-thenable
    policy: { rules: [{ step: 'picks', then: 'pause' as const }] },
  };

  it('replays a pick only for the choice it answered', () => {
    const first = startAction(pendingLoaded.ruleset, character as never, input);
    if (!('status' in first) || first.status !== 'paused') throw new Error('expected a pause');
    const second = continueAction(pendingLoaded.ruleset, first, {
      option: 'test-pack:skills.tracking',
    });
    if (!('status' in second) || second.status !== 'paused') throw new Error('expected a pause');
    expect(second.needs).toMatchObject({ choice: { id: 'advanced' } });
    // A recorded pick that names another choice no longer fits on replay.
    const state = structuredClone(second.state) as { answers: { choice?: unknown }[] };
    const answer = state.answers.at(-1) as { choice?: unknown };
    answer.choice = { choice: ['calling', 'test-pack:callings.hunter', 'gift'] };
    const replayed = continueAction(
      pendingLoaded.ruleset,
      { ...second, state: state as never },
      { option: 'test-pack:skills.ambush' },
    );
    expect(replayed).toMatchObject({ ok: false, errors: [{ code: 'answer-mismatch' }] });
  });
});
