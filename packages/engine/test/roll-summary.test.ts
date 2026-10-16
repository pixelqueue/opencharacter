import { describe, expect, it } from 'vitest';
import * as f from '../src/formula/index.ts';
import { resolveRoll, rollSummary, rollTests } from '../src/core/roll-summary.ts';

const roots = {
  flags: {
    target: 34,
    dc: -1,
    dice: f.wrapValue({
      kind: 'dice',
      value: { terms: [{ count: 1, sides: 8, sign: 1, modifiers: [] }], flat: 0 },
    } as never),
  },
  params: { name: 'x', view: { ac: 15 } },
};
const evaluate = (node: f.Node): f.Value => {
  const result = f.evaluate(node, { roots, field: () => undefined });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
};
const tree = (text: string): f.Node => {
  const parsed = f.parse(text);
  if (!parsed.ok) throw new Error(text);
  return parsed.value;
};
const resolved = (text: string) => f.print(resolveRoll(tree(text), evaluate));

describe('resolving a band condition', () => {
  it('replaces every subexpression that does not read roll with its value', () => {
    expect(resolved('roll.total < flags.target && roll.total < 90')).toBe(
      'roll.total < 34 && roll.total < 90',
    );
    expect(resolved('roll.total >= params.view.ac + 2')).toBe('roll.total >= 17');
  });

  it('prints strings quoted and dice values in dice notation', () => {
    expect(resolved("roll.total > 0 && params.name == 'x'")).toBe('roll.total > 0');
    expect(resolved('roll.total > 0 ? flags.dice : 1d4')).toBe('roll.total > 0 ? 1d8 : 1d4');
  });

  it('folds literal guards as evaluation would', () => {
    expect(resolved('flags.dc < 0')).toBe('true');
    expect(resolved('flags.dc >= 0 && roll.total >= flags.dc')).toBe('false');
    expect(resolved('flags.dc < 0 || roll.total >= flags.dc')).toBe('true');
    expect(resolved('flags.dc < 0 && roll.total >= 10')).toBe('roll.total >= 10');
    expect(resolved('flags.dc >= 0 || roll.total >= 10')).toBe('roll.total >= 10');
    expect(resolved('flags.target > 0 ? roll.total < 5 : roll.total < 9')).toBe('roll.total < 5');
    expect(resolved('!(flags.dc < 0) && roll.total > 1')).toBe('false');
    // A literal `true` operand of `&&` (`false` of `||`) on the right drops out too.
    expect(resolved('roll.total > 1 && flags.dc < 0')).toBe('roll.total > 1');
    expect(resolved('roll.total > 1 || flags.dc > 0')).toBe('roll.total > 1');
    expect(resolved('roll.total > 1 && flags.dc > 0')).toBe('roll.total > 1 && false');
  });

  it('leaves a subexpression that fails, or gives a map, as written', () => {
    expect(resolved('roll.total < flags.missing')).toBe('roll.total < flags.missing');
    expect(resolved('roll.total < 1 / 0')).toBe('roll.total < 1 / 0');
    expect(resolved('roll.total > 0 && params.view')).toBe('roll.total > 0 && params.view');
  });
});

const tests = (text: string) => rollTests(tree(text));

describe('structured tests', () => {
  it('lists a conjunction of comparisons of a roll path with a number', () => {
    expect(tests('roll.total < 34 && roll.total < 90')).toEqual([
      { of: 'roll.total', compare: 'lt', value: 34 },
      { of: 'roll.total', compare: 'lt', value: 90 },
    ]);
    expect(tests('roll.kept[0] >= 20')).toEqual([{ of: 'roll.kept[0]', compare: 'ge', value: 20 }]);
    expect(tests('roll.value == 3')).toEqual([{ of: 'roll.value', compare: 'eq', value: 3 }]);
    expect(tests('roll.unbounded <= -1')).toEqual([
      { of: 'roll.unbounded', compare: 'le', value: -1 },
    ]);
  });

  it('puts the roll path on the left', () => {
    expect(tests('34 > roll.total')).toEqual([{ of: 'roll.total', compare: 'lt', value: 34 }]);
    expect(tests('2.5 <= roll.total')).toEqual([{ of: 'roll.total', compare: 'ge', value: 2.5 }]);
  });

  it('gives [] for true and nothing for anything else', () => {
    expect(tests('true')).toEqual([]);
    expect(tests('roll.total != 3')).toBeUndefined();
    expect(tests('roll.total % 11 == 0')).toBeUndefined();
    expect(tests('roll.total < 3 || roll.total > 9')).toBeUndefined();
    expect(tests('roll.total - 2 >= 3')).toBeUndefined();
    expect(tests('count(roll.faces, 6) >= 2')).toBeUndefined();
    expect(tests('roll.faces[0] == 1')).toBeUndefined();
    expect(tests('roll.total < roll.kept[0]')).toBeUndefined();
  });
});

describe('a summary', () => {
  it('leaves out bands that cannot hold and stops after one that always does', () => {
    const summary = rollSummary(
      'test:attack',
      {
        bands: [
          { id: 'critical', when: 'roll.kept[0] >= 20' },
          { id: 'rolled', when: 'flags.dc < 0' },
          { id: 'hit', when: 'roll.total >= flags.dc' },
          { id: 'miss', when: true },
        ],
      },
      { dc: -1 },
      evaluate,
    );
    expect(summary).toEqual({
      bandSet: 'test:attack',
      bands: [
        {
          band: 'critical',
          when: 'roll.kept[0] >= 20',
          tests: [{ of: 'roll.kept[0]', compare: 'ge', value: 20 }],
        },
        { band: 'rolled', when: 'true', tests: [] },
      ],
      flags: { dc: -1 },
    });
  });

  it('has flags only without a band set, dice values as dice notation', () => {
    expect(rollSummary(undefined, undefined, roots.flags, evaluate)).toEqual({
      flags: { target: 34, dc: -1, dice: '1d8' },
    });
  });

  it('resolves a set value', () => {
    const summary = rollSummary(
      'test:rank',
      { value: 'roll.total >= flags.target ? 1 : 0', bands: [{ id: 'any', when: true }] },
      {},
      evaluate,
    );
    expect(summary.value).toBe('roll.total >= 34 ? 1 : 0');
  });
});
