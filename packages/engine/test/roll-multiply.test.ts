import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadRuleset, startAction } from '../src/index.ts';
import { readPack } from './packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const character = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-roll-multiply', version: '0.1.0' }],
  values: { 'test-roll-multiply:crit': true, 'test-roll-multiply:weak': true },
};

function load(change: (rules: Record<string, unknown>) => void) {
  const release = readPack(`${root}packages/spec/tests/packs/test-roll-multiply`);
  change(release.rules as Record<string, unknown>);
  const loaded = loadRuleset([release]);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  return loaded.ruleset;
}

function total(ruleset: ReturnType<typeof load>, face: number): unknown {
  const result = startAction(
    ruleset,
    character,
    { action: { id: 'test-roll-multiply:strike' } },
    () => [face],
  );
  if (!('status' in result) || result.status !== 'finished') throw new Error('not finished');
  return result.outcome.data?.total;
}

describe('multiply', () => {
  it('applies every counted factor in turn, rounding after each', () => {
    // 5 → 10 → 5 and 3 → 6 → 3: 8. Halving first would give 2 → 4 and 1 → 2.
    expect(
      total(
        load(() => {}),
        5,
      ),
    ).toBe(8);
  });

  it('stacks by key, compared by factor', () => {
    const ruleset = load((rules) => {
      for (const effect of rules.effects as { id: string; stackKey?: string }[])
        if (effect.id === 'crit' || effect.id === 'weak') effect.stackKey = 'size';
      rules.settings = { stacking: { keys: { size: 'highestOnly' } } };
    });
    // Only the crit's 2 counts: 10 + 6.
    expect(total(ruleset, 5)).toBe(16);
  });
});
