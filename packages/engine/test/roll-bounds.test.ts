import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadRuleset, startAction } from '../src/index.ts';
import { readPack } from './packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const loaded = loadRuleset([readPack(`${root}packages/spec/tests/packs/test-roll-bounds`)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;
const character = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-roll-bounds', version: '0.1.0' }],
};
const never = () => {
  throw new Error('a roll with no dice asked for dice');
};

describe('a roll with no dice', () => {
  it('never asks the dice function, pauses or records an answer', () => {
    const result = startAction(
      ruleset,
      character,
      {
        action: { id: 'test-roll-bounds:flat' },
        params: { value: 2 },
        policy: { dice: 'pause' },
      },
      never,
    );
    expect(result).toMatchObject({ status: 'finished', outcome: { result: 'miss' } });
    if (!('status' in result) || result.status !== 'finished') return;
    expect(result.log).toHaveLength(1);
    expect(result.log[0]).not.toHaveProperty('faces');
    expect(result.log[0]).toMatchObject({ by: 'engine', total: 2, band: 'miss' });
  });
});

describe('the step result', () => {
  it('has the bounded total, the total before the bounds and the bounds', () => {
    const result = startAction(
      ruleset,
      {
        ...character,
        values: { 'test-roll-bounds:cap': 2 },
      },
      { action: { id: 'test-roll-bounds:try' } },
      () => [6],
    );
    expect(result).toMatchObject({
      status: 'finished',
      outcome: { result: 'miss', data: { total: 2, unbounded: 6, bounds: 1 } },
    });
  });
});

describe('loading', () => {
  it("qualifies a field's band set format", () => {
    const fate = loadRuleset([readPack(`${root}packs/fate/core`)]);
    if (!fate.ok) throw new Error(JSON.stringify(fate.errors));
    expect(fate.ruleset.rules.display.fields['fate-core:skills.fight']?.format).toEqual({
      bands: 'fate-core:ladder',
    });
  });

  it('type-checks a bound on a roll as an integer', () => {
    const release = readPack(`${root}packages/spec/tests/packs/test-roll-bounds`);
    const rules = release.rules as { effects: unknown[] };
    rules.effects = [...rules.effects, { target: { rolls: ['try'] }, op: 'atLeast', value: '1.5' }];
    const bad = loadRuleset([release]);
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors).toMatchObject([{ code: 'formula-error', data: { cause: 'type-mismatch' } }]);
  });
});
