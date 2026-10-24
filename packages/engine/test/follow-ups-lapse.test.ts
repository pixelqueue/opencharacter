import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyChanges, computeSheet, loadRuleset, startAction } from '../src/index.ts';
import type { Change } from '../src/core/changes.ts';
import type { CharacterDoc } from '../src/core/pack-types.ts';
import { readPack } from './packs.ts';

// A stored `becomes` follow-up is stored once and ends with its condition, over a chain of
// batches the shared cases (one batch each) can't show.

const root = fileURLToPath(new URL('../../..', import.meta.url));
const loaded = loadRuleset([readPack(`${root}packs/mork-borg/core`)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const start: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'mork-borg-core', version: '0.2.0' }],
  values: { 'mork-borg-core:hp.max': 8, 'mork-borg-core:hp.current': 1 },
} as CharacterDoc;

const setHp = (character: CharacterDoc, value: number) => {
  const change = { type: 'set', field: 'mork-borg-core:hp.current', value } as unknown as Change;
  const result = applyChanges(ruleset, character, [change]);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
};

const stored = (c: CharacterDoc) => (c.followUps ?? []).map((e) => e.id);

describe('stored becomes follow-ups', () => {
  it('stores broken once at 0 HP and drops it when HP leaves 0', () => {
    let c = start;
    const steps: [number, string[], string[]][] = [
      [0, ['broken-1'], ['broken-1']],
      [1, [], []],
      [0, ['broken-1'], ['broken-1']],
      [0, [], ['broken-1']],
      [-1, [], []],
    ];
    for (const [hp, listed, kept] of steps) {
      const result = setHp(c, hp);
      c = result.character;
      expect(result.followUps.map((o) => o.id)).toEqual(listed);
      expect(stored(c)).toEqual(kept);
    }
  });

  it("clears a file's stale stored copies on computeSheet and on the next change", () => {
    const qa = {
      ...start,
      values: { ...start.values, 'mork-borg-core:hp.current': -1 },
      followUps: [
        { id: 'broken-1', followUp: 'mork-borg-core:broken' },
        { id: 'broken-2', followUp: 'mork-borg-core:broken' },
      ],
    } as CharacterDoc;
    expect(computeSheet(ruleset, qa).offers).toEqual([]);
    const run = startAction(ruleset, qa, {
      action: { id: 'mork-borg-core:broken', followUp: 'broken-1' },
    });
    expect('errors' in run ? run.errors.map((e) => e.code) : []).toEqual(['unknown-follow-up']);
    expect(setHp(qa, -2).character.followUps).toBeUndefined();
  });
});
