import { describe, expect, it } from 'vitest';
import { type CharacterDoc, diceFrom, loadRuleset, startAction } from '../src/index.ts';

const load = (steps: unknown[], extra: Record<string, unknown> = {}) =>
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
        resultBands: {
          hit: {
            bands: [
              { id: 'hit', when: 'roll.total >= 4' },
              { id: 'miss', when: 'true' },
            ],
          },
        },
        actions: [{ id: 'go', steps, ...extra }],
      },
      content: [],
    } as never,
  ]);

const character: CharacterDoc = {
  specVersion: '0.2.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
};

const run = (steps: unknown[], faces: number[] = [], policy?: object) => {
  const loaded = load(steps);
  if (!loaded.ok) return loaded.errors.map((e) => [e.code, (e.data as { cause?: string }).cause]);
  return startAction(
    loaded.ruleset,
    character,
    { action: { id: 'test-pack:go' }, ...(policy ? { policy } : {}) },
    diceFrom(faces),
  );
};

const rolls = (max: string, until = 'steps.die.total < 6') => [
  {
    id: 'g',
    kind: 'group',
    repeat: { while: until, max },
    steps: [{ id: 'die', kind: 'roll', parts: [{ dice: '1d6' }] }],
  },
];

const out = (data: string) => ({ id: 'done', kind: 'outcome', data: { out: data } });

describe('a group step', () => {
  it('stops at max, and runs no pass with max 0', () => {
    expect(run([...rolls('2'), out('size(steps.g)')], [1, 2, 3])).toMatchObject({
      outcome: { data: { out: 2 } },
    });
    expect(run([...rolls('0'), out('size(steps.g)')])).toMatchObject({
      outcome: { data: { out: 0 } },
    });
  });

  it('stops once while is false', () => {
    expect(
      run(
        [...rolls('5'), { id: 'done', kind: 'outcome', data: { out: 'steps.die.total' } }],
        [2, 6, 1],
      ),
    ).toMatchObject({ outcome: { data: { out: 6 } } });
  });

  it('is safety-limit-exceeded past maxGroupPasses', () => {
    expect(run(rolls('1000', 'true'), Array(200).fill(1))).toMatchObject({
      ok: false,
      errors: [{ code: 'safety-limit-exceeded', data: { limit: 'maxGroupPasses' } }],
    });
  });

  it('pauses at a pass path that policy rules match', () => {
    // oxlint-disable-next-line unicorn/no-thenable
    const policy = { rules: [{ step: 'g[1]/die', then: 'pause' }] };
    expect(run(rolls('3'), [1, 1], policy)).toMatchObject({
      status: 'paused',
      needs: { step: 'g[1]/die', kind: 'dice' },
    });
  });

  it("classifies the latest pass's roll again after the group", () => {
    expect(
      run(
        [
          ...rolls('3'),
          { id: 'again', kind: 'roll', of: 'die', bands: 'hit' },
          { id: 'done', kind: 'outcome', data: { band: 'steps.again.band' } },
        ],
        [2, 5, 6],
      ),
    ).toMatchObject({ outcome: { data: { band: 'hit' } }, log: [{}, {}, {}, { of: 'g[2]/die' }] });
  });

  it('types while, max and the passes at load', () => {
    expect(run(rolls('2', '1'))).toEqual([['formula-error', 'type-mismatch']]);
    expect(run(rolls("'two'"))).toEqual([['formula-error', 'type-mismatch']]);
    expect(
      run([...rolls('2'), { id: 'done', kind: 'outcome', result: 'steps.g[0].die.total' }]),
    ).toEqual([['formula-error', 'type-mismatch']]);
  });
});

describe('a group in an each branch', () => {
  it('runs its passes per participant', () => {
    const loaded = load(
      [
        {
          id: 'per',
          kind: 'branch',
          each: 'target',
          cases: [
            {
              when: true,
              steps: [
                {
                  id: 'g',
                  kind: 'group',
                  repeat: { while: 'steps.die.total < 3', max: 3 },
                  steps: [{ id: 'die', kind: 'roll', parts: [{ dice: '1d6' }] }],
                },
              ],
            },
          ],
        },
        {
          id: 'done',
          kind: 'outcome',
          data: { passes: 'mapList(steps.g, size(x))', last: 'mapList(steps.die, x.total)' },
        },
      ],
      { participants: { target: {} } },
    );
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const result = startAction(
      loaded.ruleset,
      character,
      { action: { id: 'test-pack:go' }, participants: { target: [{ id: 'a' }, { id: 'b' }] } },
      diceFrom([1, 4, 5]),
    );
    expect(result).toMatchObject({ outcome: { data: { passes: [2, 1], last: [4, 5] } } });
  });
});
