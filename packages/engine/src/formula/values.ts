import type { DiceModifier } from './ast.ts';
import { fail } from './errors.ts';
import { MAX_INT } from './limits.ts';

export interface DiceTerm {
  sign: 1 | -1;
  count: number;
  sides: number | 'F';
  zero?: true;
  modifiers: DiceModifier[];
}

export interface DiceValue {
  terms: DiceTerm[];
  flat: number;
}

/** A formula value. Tagged so that int and decimal stay distinct (2 vs 2.0). */
export type Value =
  | { kind: 'int'; value: number }
  | { kind: 'decimal'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'string'; value: string }
  | { kind: 'null' }
  | { kind: 'list'; value: Value[] }
  | { kind: 'dice'; value: DiceValue }
  | { kind: 'object'; value: Record<string, unknown> };

export const int = (value: number): Value => {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_INT) fail('overflow', 'integer overflow');
  return { kind: 'int', value: value === 0 ? 0 : value };
};

export const decimal = (value: number): Value => {
  if (!Number.isFinite(value)) fail('overflow', 'decimal result is not finite');
  return { kind: 'decimal', value: roundDecimal(value) };
};

export const DECIMAL_PLACES = 6;

const SCALE = 10n ** BigInt(DECIMAL_PLACES);
const view = new DataView(new ArrayBuffer(8));

/**
 * Rounds a double to six places: its exact binary value to the nearest multiple of 10⁻⁶, ties
 * away from zero. Whole numbers and non-finite values come back as they are; -0 becomes 0.
 */
export function roundDecimal(x: number): number {
  if (x === 0) return 0;
  if (!Number.isFinite(x) || Number.isInteger(x)) return x;
  // x = ±m × 2^-k exactly, with k > 0 since x isn't whole.
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  const m = exponent === 0 ? fraction : fraction | (1n << 52n);
  const k = BigInt(1075 - Math.max(exponent, 1));
  // |x| × 10⁶ = m × 10⁶ / 2^k: the quotient, rounded up when the remainder is half or more.
  const scaled = m * SCALE;
  let q = scaled >> k;
  if (scaled - (q << k) >= 1n << (k - 1n)) q += 1n;
  if (q === 0n) return 0;
  // Parsing the decimal text gives the double nearest it, whatever its size.
  return Number(`${x < 0 ? '-' : ''}${q}e-${DECIMAL_PLACES}`);
}

export const bool = (value: boolean): Value => ({ kind: 'bool', value });
export const str = (value: string): Value => ({ kind: 'string', value });

const WRAPPED = Symbol('ocf.value');

export function wrapValue(value: Value): object {
  return { [WRAPPED]: value };
}

/**
 * Converts plain data (context roots, character data) to a value. Whole numbers become `int`,
 * other numbers `decimal`; objects stay opaque until a member is selected.
 */
export function fromData(data: unknown): Value {
  if (data === null || data === undefined) return { kind: 'null' };
  if (typeof data === 'boolean') return bool(data);
  if (typeof data === 'string') return str(data);
  if (typeof data === 'number') return Number.isInteger(data) ? int(data) : decimal(data);
  if (Array.isArray(data)) return { kind: 'list', value: data.map(fromData) };
  if (typeof data === 'object' && WRAPPED in data) return (data as { [WRAPPED]: Value })[WRAPPED];
  if (typeof data === 'object') return { kind: 'object', value: data as Record<string, unknown> };
  return fail('type-mismatch', `unsupported data of type ${typeof data}`);
}

export function toData(value: Value): unknown {
  switch (value.kind) {
    case 'null':
      return null;
    case 'list':
      return value.value.map(toData);
    default:
      return value.value;
  }
}

export function isNumber(value: Value): value is { kind: 'int' | 'decimal'; value: number } {
  return value.kind === 'int' || value.kind === 'decimal';
}

export function describe(value: Value): string {
  return value.kind;
}
