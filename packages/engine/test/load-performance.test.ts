import { resolve } from 'node:path';
import { paths } from '@opencharacter/spec/node';
import { describe, expect, it } from 'vitest';
import { formula, loadRuleset, type PackRelease } from '../src/index.ts';
import { readPack } from './packs.ts';

// The query precompute must parse each condition and build each item's view once, and the formula
// checks must not scan every action once per option flag; otherwise orc-2e takes seconds to load.
// The bound is generous enough for a slow CI machine and still catches that.

const orc2e = readPack(resolve(paths.tests, '../../../packs/orc/2e'));

const time = (fn: () => void) => {
  const start = performance.now();
  fn();
  return performance.now() - start;
};

describe('loadRuleset performance', () => {
  it('loads orc-2e in under a second and a half', () => {
    // The best of up to three loads: the conformance files keep every core busy, and a
    // first load in a fresh worker also pays for compiling the engine. A real regression is slow on
    // every load, so it still fails.
    let best = Infinity;
    for (let i = 0; i < 3 && best >= 1500; i++) {
      let ok = false;
      best = Math.min(
        best,
        time(() => {
          ok = loadRuleset([orc2e]).ok;
        }),
      );
      expect(ok).toBe(true);
    }
    expect(best).toBeLessThan(1500);
  });
});

// A release the app vouches for skips the formula checks; anything else is checked.
const broken = (formulas?: PackRelease['formulas']): PackRelease =>
  ({
    manifest: {
      id: 'test-pack',
      version: '1.0.0',
      specVersion: '0.1.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: { fields: { hp: { type: 'integer', formula: 'missing + 1' } } },
    content: [],
    ...(formulas ? { formulas } : {}),
  }) as unknown as PackRelease;

const causes = (result: ReturnType<typeof loadRuleset>) =>
  result.ok ? [] : result.errors.map((e) => [e.code, e.data?.cause]);

describe('loadRuleset prechecked releases', () => {
  const parsed = formula.parse('missing + 1');
  if (!parsed.ok) throw new Error('parse');
  const table = { 'missing + 1': { text: formula.print(parsed.value), tree: parsed.value } };

  it('checks a release the app does not vouch for', () => {
    expect(causes(loadRuleset([broken(table)]))).toEqual([['formula-error', 'unknown-name']]);
  });

  it("skips a vouched-for release's formula checks", () => {
    const release = broken(table);
    expect(loadRuleset([release], { prechecked: new Set([release]) }).ok).toBe(true);
  });

  it('matches by object, not by pack ID', () => {
    const release = broken(table);
    const other = broken(table);
    expect(causes(loadRuleset([other], { prechecked: new Set([release]) }))).toEqual([
      ['formula-error', 'unknown-name'],
    ]);
  });

  it('checks a release without a compiled formula table', () => {
    const source = broken();
    expect(causes(loadRuleset([source], { prechecked: new Set([source]) }))).toEqual([
      ['formula-error', 'unknown-name'],
    ]);
  });

  it('still refuses a compiled tree that does not match its text', () => {
    const release = broken({
      'missing + 1': { text: 'missing + 2', tree: table['missing + 1'].tree },
    });
    expect(causes(loadRuleset([release], { prechecked: new Set([release]) }))).toEqual([
      ['formula-error', 'compiled-mismatch'],
    ]);
  });
});
