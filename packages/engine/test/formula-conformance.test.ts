import { describe, expect, it } from 'vitest';
import * as f from '../src/formula/index.ts';
import { checkContext, evalContext, type FormulaCase, loadCaseFiles } from './formula-cases.ts';

function parsed(text: string): f.Node {
  const result = f.parse(text);
  if (!result.ok)
    throw new Error(`expected "${text}" to parse: ${result.error.code} ${result.error.message}`);
  return result.value;
}

function run(c: FormulaCase): void {
  if (c.parse !== undefined) {
    const result = f.parse(c.parse);
    if (c.error) {
      expect(result.ok ? 'parsed' : result.error.code).toBe(c.error);
      return;
    }
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    if (c.tree !== undefined) expect(result.value).toEqual(c.tree);
    const text = f.print(result.value);
    if (c.print !== undefined) expect(text).toBe(c.print);
    expect(parsed(text), 'round trip').toEqual(result.value);
    return;
  }

  if (c.check !== undefined) {
    const tree = f.parse(c.check);
    if (!tree.ok) {
      expect(tree.error.code).toBe(c.error);
      return;
    }
    const result = f.check(tree.value, checkContext(c));
    let outcome: string;
    if (!result.ok) outcome = result.error.code;
    else if (c.expect !== undefined && !f.assignable(result.value, f.parseTypeName(c.expect)))
      outcome = 'type-mismatch';
    else outcome = 'ok';
    expect(outcome).toBe(c.error ?? 'ok');
    if (result.ok && c.type !== undefined) expect(f.typeName(result.value)).toBe(c.type);
    return;
  }

  const text = c.evaluate ?? c.roll;
  if (text === undefined) throw new Error('case has no parse, check, evaluate or roll');
  const tree = f.parse(text);
  if (!tree.ok) {
    expect(tree.error.code).toBe(c.error);
    return;
  }
  const value = f.evaluate(tree.value, evalContext(c));
  if (c.evaluate !== undefined) {
    if (c.error) {
      expect(value.ok ? 'ok' : value.error.code).toBe(c.error);
      return;
    }
    if (!value.ok) throw new Error(`${value.error.code}: ${value.error.message}`);
    if (c.valueType !== undefined) expect(value.value.kind).toBe(c.valueType);
    if ('value' in c) expect(f.toData(value.value)).toEqual(c.value);
    return;
  }

  // roll
  if (!value.ok) {
    expect(value.error.code).toBe(c.error);
    return;
  }
  const dice: f.DiceValue =
    value.value.kind === 'dice'
      ? value.value.value
      : value.value.kind === 'int'
        ? { terms: [], flat: value.value.value }
        : (() => {
            throw new Error(`roll case evaluated to ${value.value.kind}`);
          })();
  const rolled = f.roll(dice, f.facesFrom(c.faces ?? []));
  if (c.error) {
    expect(rolled.ok ? 'ok' : rolled.error.code).toBe(c.error);
    return;
  }
  if (!rolled.ok) throw new Error(`${rolled.error.code}: ${rolled.error.message}`);
  if (c.total !== undefined) expect(rolled.value.total).toBe(c.total);
  if (c.terms !== undefined) expect(rolled.value.terms).toMatchObject(c.terms);
}

describe('formula conformance (packages/spec/tests/cases/formulas)', () => {
  for (const file of loadCaseFiles()) {
    describe(`${file.file}: ${file.description}`, () => {
      it.each(file.cases.map((c) => [c.name, c] as const))('%s', (_, c) => run(c));
    });
  }
});
