import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { paths } from '@opencharacter/spec/node';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  applyChanges,
  type Change,
  type CharacterDoc,
  diceFrom,
  listOptions,
  loadRuleset,
  startAction,
} from '../src/index.ts';
import { readPack } from './packs.ts';

// listOptions must not build a full trial sheet per candidate or run a choice's query once per
// pick; otherwise a random wizard takes many seconds. The bounds are generous enough for a slow CI
// machine and still catch that.

const cases = join(paths.tests, 'cases');
const read = (...parts: string[]) => parse(readFileSync(join(cases, ...parts), 'utf8'));
const loaded = loadRuleset([readPack(resolve(cases, '../../../../packs/5e/srd-5.1'))]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const time = (fn: () => void) => {
  const start = performance.now();
  fn();
  return performance.now() - start;
};

describe('listOptions performance', () => {
  it("runs 5E's random wizard in a few seconds", () => {
    const character = read('actions/5e-create-random-wizard/character.yaml') as CharacterDoc;
    const faces = read('actions/5e-create-random-wizard/dice.yaml') as number[];
    let status: string | undefined;
    const ms = time(() => {
      const result = startAction(
        ruleset,
        character,
        {
          action: { id: '5e-srd-5.1:create-random-character' },
          policy: { dice: 'auto', choices: 'auto', allocations: 'auto' },
        },
        diceFrom(faces),
      );
      status = 'status' in result ? result.status : undefined;
    });
    expect(status).toBe('finished');
    expect(ms).toBeLessThan(4000);
  });

  it("lists a full wizard spellbook's options in well under a second", () => {
    const base = 'changes/5e-create-random-wizard-finishes';
    const applied = applyChanges(
      ruleset,
      read(base, 'character.yaml') as CharacterDoc,
      read(base, 'changes.yaml') as Change[],
    );
    if (!applied.ok) throw new Error(JSON.stringify(applied.errors));
    let count = 0;
    const ms = time(() => {
      const result = listOptions(ruleset, applied.character, {
        entry: 'class',
        choice: ['5e-srd-5.1:features.wizard.spellcasting/spellbook-1'],
      });
      count = 'options' in result ? result.options.length : 0;
    });
    expect(count).toBeGreaterThan(100);
    expect(ms).toBeLessThan(1500);
  });
});
