import { describe, expect, it } from 'vitest';
import { checkFormula, controlFor, isContentItem, toInput, toValue } from '../src/model.ts';

describe('item form model', () => {
  it('picks a control per declared type', () => {
    expect(controlFor({ type: 'enum', values: ['a'] })).toBe('select');
    expect(controlFor({ type: 'boolean' })).toBe('checkbox');
    expect(controlFor({ type: 'dice' })).toBe('formula');
    expect(controlFor({ type: 'integer' })).toBe('formula');
    expect(controlFor({ type: 'set', of: 'tag' })).toBe('list');
    expect(controlFor({ type: 'string' })).toBe('text');
  });

  it('saves numbers as numbers, lists as lists, empty as removal', () => {
    expect(toValue({ type: 'integer' }, '3')).toBe(3);
    expect(toValue({ type: 'integer' }, 'level.total + 1')).toBe('level.total + 1');
    expect(toValue({ type: 'set' }, 'a, b,, c')).toEqual(['a', 'b', 'c']);
    expect(toValue({ type: 'string' }, '  ')).toBeNull();
    expect(toValue({ type: 'boolean' }, true)).toBe(true);
    expect(toInput(['a', 'b'])).toBe('a, b');
    expect(toInput(undefined)).toBe('');
  });

  it('checks formulas with the reference parser', () => {
    expect(checkFormula('1d8')).toEqual({ ok: true });
    expect(checkFormula('1d20  +abilities.str.mod')).toEqual({
      ok: true,
      canonical: '1d20 + abilities.str.mod',
    });
    expect(checkFormula('1d20kx1').ok).toBe(false);
    expect(checkFormula('3')).toEqual({ ok: true });
  });

  it('recognizes content item paths', () => {
    expect(isContentItem('packs/5e/srd-5.1/content/weapons/longsword.yaml')).toBe(true);
    expect(isContentItem('packs/5e/srd-5.1/rules/core.yaml')).toBe(false);
  });
});
