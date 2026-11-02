import { describe, expect, it } from 'vitest';
import { continueAction, loadRuleset, startAction, type PackRelease } from '../src/index.ts';

/**
 * A pack whose `attack` hits its target at a step tagged `attack-hit`, and whose `save` the
 * target runs; features add riders through `action` effects.
 */
const pack = (features: Record<string, unknown[]>, hit?: Record<string, unknown>): PackRelease =>
  ({
    manifest: {
      id: 'p',
      version: '1.0.0',
      specVersion: '0.3.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: {
      tags: ['attack-hit'],
      fields: { n: { type: 'integer', input: true, default: 0 } },
      contentTypes: { feature: {} },
      actions: [
        {
          id: 'save',
          params: { ability: { type: 'string' }, dc: { type: 'integer' } },
          results: ['success', 'failure'],
          steps: [{ id: 'done', kind: 'outcome', result: "'failure'" }],
        },
        {
          id: 'mark',
          params: { by: { type: 'integer', default: 1 } },
          steps: [
            {
              id: 'add',
              kind: 'changes',
              changes: [{ type: 'adjust', field: 'n', by: 'params.by' }],
            },
            { id: 'done', kind: 'outcome', result: "'marked'", data: { by: 'params.by' } },
          ],
        },
        {
          id: 'attack',
          participants: { target: { max: 2 } },
          steps: [
            {
              id: 'hit',
              kind: 'changes',
              tags: ['attack-hit'],
              to: 'target',
              changes: [{ type: 'adjust', field: 'n', by: -1 }],
              ...hit,
            },
          ],
        },
      ],
    },
    content: Object.entries(features).map(([id, effects]) => ({
      id: `features.${id}`,
      type: 'feature',
      effects,
    })),
  }) as unknown as PackRelease;

const save = (id: string, dc: number, extra: Record<string, unknown> = {}) => ({
  target: { steps: ['attack-hit'] },
  op: 'action',
  value: {
    id,
    use: 'save',
    each: 'target',
    as: 'participant',
    params: { ability: "'con'", dc: String(dc) },
    changes: [
      {
        type: 'adjust',
        field: 'n',
        by: -dc,
        when: "run.result == 'failure'",
      },
    ],
    ...extra,
  },
});

const setup = (features: Record<string, unknown[]>, hit?: Record<string, unknown>) => {
  const loaded = loadRuleset([pack(features, hit)]);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  const character = {
    specVersion: '0.3.0',
    id: 'hero',
    packs: [{ id: 'p', version: '1.0.0' }],
    features: Object.keys(features).map((id) => ({ id, item: `p:features.${id}` })),
  };
  return { ruleset: loaded.ruleset, character };
};

type Result = ReturnType<typeof startAction>;

const codes = (r: Result) => ('errors' in r && r.errors ? r.errors.map((e) => e.code) : []);

/** Answers each handoff with the result `answer` gives for its path, until the run finishes. */
const runAll = (
  ruleset: ReturnType<typeof setup>['ruleset'],
  first: Result,
  answer: (step: string) => string,
): { steps: string[]; result: Result } => {
  const steps: string[] = [];
  let result = first;
  while ('status' in result && result.status === 'paused') {
    const needs = result.needs as { step: string; kind: string };
    expect(needs.kind).toBe('handoff');
    steps.push(needs.step);
    result = continueAction(
      ruleset,
      result as never,
      {
        outcome: { result: answer(needs.step) },
      } as never,
    );
  }
  return { steps, result };
};

describe('action effects on a tagged changes step', () => {
  it('hand off one save per feature, per target, at their own DCs', () => {
    const { ruleset, character } = setup({ a: [save('stun', 13)], b: [save('trip', 15)] });
    const first = startAction(ruleset, character as never, {
      action: { id: 'p:attack' },
      participants: { target: [{ id: 't1' }, { id: 't2' }] },
    });
    expect(first).toMatchObject({
      status: 'paused',
      needs: {
        kind: 'handoff',
        step: 'hit/p:features.a#stun[0]',
        participant: { role: 'target', id: 't1' },
        run: { action: 'p:save', params: { ability: 'con', dc: 13 } },
      },
    });
    // t1 resists the stun; everything else lands.
    const { steps, result } = runAll(ruleset, first, (step) =>
      step === 'hit/p:features.a#stun[0]' ? 'success' : 'failure',
    );
    expect(steps).toEqual([
      'hit/p:features.a#stun[0]',
      'hit/p:features.a#stun[1]',
      'hit/p:features.b#trip[0]',
      'hit/p:features.b#trip[1]',
    ]);
    if (!('proposedChanges' in result)) throw new Error(JSON.stringify(result));
    expect(
      result.proposedChanges.map((p) => [p.character, (p.change as { by: number }).by, p.step]),
    ).toEqual([
      ['t1', -1, 'hit'],
      ['t2', -1, 'hit'],
      ['t2', -13, 'hit'],
      ['t1', -15, 'hit'],
      ['t2', -15, 'hit'],
    ]);
  });

  it('runs for the current participant in an each step, and only while its when holds', () => {
    const { ruleset, character } = setup(
      {
        a: [{ ...save('stun', 13), when: "participant.id == 't2'" }],
      },
      { each: 'target' },
    );
    const first = startAction(ruleset, character as never, {
      action: { id: 'p:attack' },
      participants: { target: [{ id: 't1' }, { id: 't2' }] },
    });
    const { steps, result } = runAll(ruleset, first, () => 'failure');
    expect(steps).toEqual(['hit[1]/p:features.a#stun']);
    if (!('proposedChanges' in result)) throw new Error(JSON.stringify(result));
    expect(result.proposedChanges.map((p) => [p.character, p.step])).toEqual([
      ['t1', 'hit[0]'],
      ['t2', 'hit[1]'],
      ['t2', 'hit[1]'],
    ]);
  });

  it('runs a local action on the actor, its changes seeing run.data', () => {
    const { ruleset, character } = setup({
      a: [
        {
          target: { steps: ['attack-hit'] },
          op: 'action',
          value: {
            id: 'mark',
            use: 'mark',
            params: { by: '2' },
            to: 'self',
            changes: [{ type: 'adjust', field: 'n', by: 'run.data.by * 10' }],
          },
        },
      ],
    });
    const result = startAction(ruleset, character as never, {
      action: { id: 'p:attack' },
      participants: { target: [{ id: 't1' }] },
    });
    if (!('proposedChanges' in result)) throw new Error(JSON.stringify(result));
    expect(
      result.proposedChanges.map((p) => [p.to, (p.change as { by: number }).by, p.step]),
    ).toEqual([
      ['target', -1, 'hit'],
      ['self', 2, 'hit/p:features.a#mark/add'],
      ['self', 20, 'hit'],
    ]);
  });

  it('fails with unknown-role for a handoff with no participant, or another role', () => {
    const noEach = setup({ a: [save('stun', 13, { each: undefined })] });
    expect(
      codes(
        startAction(noEach.ruleset, noEach.character as never, {
          action: { id: 'p:attack' },
          participants: { target: [{ id: 't1' }] },
        }),
      ),
    ).toEqual(['unknown-role']);
    const other = setup({ a: [save('stun', 13, { each: 'ally' })] }, { each: 'target' });
    expect(
      codes(
        startAction(other.ruleset, other.character as never, {
          action: { id: 'p:attack' },
          participants: { target: [{ id: 't1' }] },
        }),
      ),
    ).toEqual(['unknown-role']);
  });

  it('runs nothing for a role the action has no participants in', () => {
    const { ruleset, character } = setup({ a: [save('stun', 13)] });
    const result = startAction(ruleset, character as never, { action: { id: 'p:attack' } });
    expect(result).toMatchObject({ status: 'finished' });
  });

  it('reports an unknown action at load', () => {
    const loaded = loadRuleset([
      pack({ a: [{ ...save('stun', 13), value: { ...save('stun', 13).value, use: 'nope' } }] }),
    ]);
    expect(loaded.ok ? [] : loaded.errors.map((e) => e.code)).toEqual(['unknown-reference']);
  });
});
