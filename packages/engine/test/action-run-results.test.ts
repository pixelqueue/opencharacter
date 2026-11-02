import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { type ActionResult, continueAction, loadRuleset, startAction } from '../src/index.ts';
import { readPack } from './packs.ts';

// An action reuses the actor's sheet across runs. What a run returns can carry that sheet's
// objects (its character root, an effect's source), so a caller editing a result in place must
// not change the next run of the same action.

const root = fileURLToPath(new URL('../../..', import.meta.url));
const loaded = loadRuleset([readPack(`${root}packs/5e/srd-5.1`)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;
const tamsin = () => parse(readFileSync(`${root}examples/characters/5e-tamsin.yaml`, 'utf8'));

/** Every string, number and key in place, as a careless caller might. */
function scribble(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const v = record[key];
    if (typeof v === 'string') record[key] = `${v}!`;
    else if (typeof v === 'number') record[key] = v + 100;
    else scribble(v, seen);
  }
  record.scribbled = true;
}

/** The action to the end: every die shows half its sides. */
function run(action: { id: string; entry?: string }): ActionResult {
  const policy = { dice: 'pause' as const };
  let result = startAction(ruleset, tamsin(), { action, params: { targetAc: 15 }, policy });
  for (let i = 0; i < 20 && 'status' in result && result.status === 'paused'; i++) {
    const faces = (result.needs.dice ?? []).flatMap((d) =>
      Array.from({ length: d.count }, () => Math.ceil(Number(d.sides) / 2)),
    );
    result = continueAction(ruleset, result, { faces }, policy);
  }
  return result;
}

describe('an action result the caller edits', () => {
  it.each([
    { id: '5e-srd-5.1:weapon-attack', entry: 'inv-1' },
    { id: '5e-srd-5.1:unarmed-strike' },
  ])("doesn't change the next run of $id", (action) => {
    const first = run(action);
    const pristine = structuredClone(first);
    scribble(first);
    expect(run(action)).toEqual(pristine);
  });
});
