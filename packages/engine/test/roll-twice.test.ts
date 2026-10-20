import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { continueAction, loadRuleset, startAction } from '../src/index.ts';
import { readPack } from './packs.ts';

const dir = fileURLToPath(new URL('../../spec/tests/packs/test-roll-twice', import.meta.url));
const loaded = loadRuleset([readPack(dir)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;
const weak = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-roll-twice', version: '0.1.0' }],
  values: { 'test-roll-twice:weak': true },
} as never;
const input = { action: { id: 'test-roll-twice:check' }, policy: { dice: 'pause' } } as never;

type Paused = Parameters<typeof continueAction>[1];

describe('a roll made twice (`of: roll`)', () => {
  it('pauses for both rolls and keeps the worse total', () => {
    const paused = startAction(ruleset, weak, input);
    expect(paused).toMatchObject({
      status: 'paused',
      needs: { dice: [{ count: 2 }, { count: 2 }], repeat: { times: 2, keep: 'low' } },
    });
    const done = continueAction(ruleset, paused as Paused, { faces: [6, 5, 2, 3] });
    expect(done).toMatchObject({ status: 'finished', outcome: { data: { total: 6, kept: 1 } } });
    if (!('log' in done)) return;
    expect(done.log[0]?.rolls?.map((r) => [r.total, r.kept])).toEqual([
      [12, false],
      [6, true],
    ]);
  });

  it('takes one answer for every roll: the first roll alone is `answer-mismatch`', () => {
    const paused = startAction(ruleset, weak, input);
    const result = continueAction(ruleset, paused as Paused, { faces: [6, 5] });
    expect(result).toMatchObject({ ok: false, errors: [{ code: 'answer-mismatch' }] });
  });
});
