import { describe, expect, it } from 'vitest';

import { formula as f } from '../src/index.ts';

// Decimals are rounded to six places, ties away from zero, on the double's exact value
// (packages/spec/docs/formulas.md, "Types").

const evaluate = (text: string) => {
  const tree = f.parse(text);
  if (!tree.ok) throw new Error(tree.error.message);
  const result = f.evaluate(tree.value, { field: () => undefined, roots: {} });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe('roundDecimal', () => {
  const r = f.roundDecimal;

  it('makes short decimal sums exact', () => {
    expect(r(0.1 + 0.2)).toBe(0.3);
    let sum = 0;
    for (let i = 0; i < 10; i++) sum = r(sum + 0.1);
    expect(sum).toBe(1);
    let coins = 0;
    for (let i = 0; i < 50; i++) coins = r(coins + 0.02);
    expect(coins).toBe(1);
  });

  it('rounds exact ties away from zero', () => {
    // 2^-7 = 0.0078125 and 2^-8 = 0.00390625 are exact doubles.
    expect(r(0.0078125)).toBe(0.007813);
    expect(r(-0.0078125)).toBe(-0.007813);
    expect(r(0.00390625)).toBe(0.003906);
    expect(r(2.5000005)).toBe(2.500001);
  });

  it('decides a written tie on the exact double', () => {
    // The double nearest 0.0000005 is just below it; the one nearest 0.0000015 just above.
    expect(r(0.0000005)).toBe(0);
    expect(r(-0.0000005)).toBe(0);
    expect(r(0.0000015)).toBe(0.000002);
    expect(r(-0.0000015)).toBe(-0.000002);
  });

  it('keeps negatives symmetric and never gives -0', () => {
    expect(r(-1 / 3)).toBe(-0.333333);
    expect(r(-2 / 3)).toBe(-0.666667);
    expect(Object.is(r(-0.0000001), 0)).toBe(true);
    expect(Object.is(r(-0), 0)).toBe(true);
  });

  it('leaves whole numbers, non-finite values and six-place values as they are', () => {
    expect(r(3)).toBe(3);
    expect(r(-(2 ** 60))).toBe(-(2 ** 60));
    expect(r(Infinity)).toBe(Infinity);
    expect(Number.isNaN(r(NaN))).toBe(true);
    for (const x of [0.1, 0.25, 1.000001, -7.654321, 123456.789012]) expect(r(x)).toBe(x);
  });

  it('handles large and tiny values', () => {
    expect(r(123456789.1 + 0.2)).toBe(123456789.3);
    expect(r(9007199254.74099)).toBe(9007199254.74099);
    expect(r(9007199254.74099 + 0.000001)).toBe(Number('9007199254.740991'));
    // Past 2^53 × 10⁻⁶ a double has fewer than six places; it rounds to the nearest double.
    expect(r(2 ** 40 + 0.5)).toBe(2 ** 40 + 0.5);
    expect(r(Number.MIN_VALUE)).toBe(0);
    expect(r(4.9e-7)).toBe(0);
    expect(r(5.1e-7)).toBe(0.000001);
  });
});

describe('decimal formulas', () => {
  it('rounds every decimal result', () => {
    expect(evaluate('0.1 + 0.2')).toEqual({ kind: 'decimal', value: 0.3 });
    expect(evaluate('1.1 - 0.2')).toEqual({ kind: 'decimal', value: 0.9 });
    expect(evaluate('0.1 * 3')).toEqual({ kind: 'decimal', value: 0.3 });
    expect(evaluate('10 / 3')).toEqual({ kind: 'decimal', value: 3.333333 });
    expect(evaluate('-(0.1 + 0.2)')).toEqual({ kind: 'decimal', value: -0.3 });
    expect(evaluate('max(0.1 + 0.2, 0.3)')).toEqual({ kind: 'decimal', value: 0.3 });
    expect(evaluate('sumList([0.1, 0.2, 0.3, 0.4], x)')).toEqual({ kind: 'decimal', value: 1 });
  });

  it('keeps ints exact', () => {
    expect(evaluate('7 / 1')).toEqual({ kind: 'decimal', value: 7 });
    expect(evaluate('2 + 3')).toEqual({ kind: 'int', value: 5 });
  });

  it('floors the six-place value', () => {
    expect(evaluate('floor(0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1)')).toEqual({
      kind: 'int',
      value: 1,
    });
  });

  it('rounds a long literal when parsed', () => {
    const tree = f.parse('0.12345678');
    expect(tree.ok && tree.value).toEqual({ type: 'decimal', value: 0.123457 });
  });

  it('reads plain data rounded', () => {
    expect(f.fromData(0.30000000000000004)).toEqual({ kind: 'decimal', value: 0.3 });
  });

  it('lists literals with more than six places', () => {
    expect(f.longDecimals('0.1234567 + 0.123456 * x + 1.00000001')).toEqual([
      '0.1234567',
      '1.00000001',
    ]);
    expect(f.longDecimals("'0.1234567'")).toEqual([]);
    expect(f.longDecimals('0.1 +')).toEqual([]);
  });
});
