import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { paths } from '@opencharacter/spec/node';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  type ActionAnswer,
  type ActionResult,
  type CharacterDoc,
  continueAction,
  diceFrom,
  loadRuleset,
  startAction,
} from '../src/index.ts';
import { readPack } from './packs.ts';

// Every answer replays the action from its start, so a replay must reuse the proposed sheets and
// listings of the run before it. Rebuilding them takes a level-up or a guided creation several
// seconds; the bounds are generous enough for a slow CI machine and still catch that.

const cases = join(paths.tests, 'cases', 'actions');
const read = (...parts: string[]) => parse(readFileSync(join(cases, ...parts), 'utf8'));
const loaded = loadRuleset([readPack(resolve(paths.tests, '../../../packs/orc/2e'))]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const time = (fn: () => void) => {
  const start = performance.now();
  fn();
  return performance.now() - start;
};

function answered(name: string): ActionResult {
  const spec = read(name, 'case.yaml');
  const character = read(name, 'character.yaml') as CharacterDoc;
  const dice = diceFrom([]);
  let result = startAction(ruleset, character, spec.input, dice);
  for (const answer of spec.answers as ActionAnswer[]) {
    if (!('status' in result) || result.status !== 'paused') break;
    result = continueAction(ruleset, result, answer, spec.input.policy, dice);
  }
  return result;
}

describe('action performance', () => {
  it('levels up a orc-2e oracle in a few seconds', () => {
    let result: ActionResult | undefined;
    const ms = time(() => {
      result = answered('orc-oracle-level-up');
    });
    expect(result && 'status' in result ? result.status : undefined).toBe('finished');
    expect(ms).toBeLessThan(5000);
  });

  it('runs a guided orc-2e creation in a few seconds', () => {
    let result: ActionResult | undefined;
    const ms = time(() => {
      result = answered('orc-create-character');
    });
    expect(result && 'status' in result ? result.status : undefined).toBe('finished');
    expect(ms).toBeLessThan(3000);
  });
});
