import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { applyChanges, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

// A follow-up's changes aimed at a pick or a grant's saved state apply where they point.

const dir = join(import.meta.dirname, '../../spec/tests/cases/changes/follow-up-pick-grant-state');
const read = (name: string) => parse(readFileSync(join(dir, name), 'utf8'));
const loaded = loadRuleset([read('case.yaml').packs[0].inline as PackRelease]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

describe('follow-up change targets', () => {
  it("change the grant's saved state and the pick's state", () => {
    const offered = applyChanges(
      ruleset,
      read('character.yaml') as CharacterDoc,
      read('changes.yaml'),
    );
    if (!offered.ok) throw new Error(JSON.stringify(offered.errors));
    // The talent's first: its uses 2 -> 1 -> 0; then the ward's charges 2 -> 1 -> 0.
    const changes = offered.followUps.toReversed().flatMap((u) => u.changes ?? []);
    const result = applyChanges(ruleset, offered.character, changes as never);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.character.features?.[0]).toEqual({
      id: 'class',
      item: 'test-pack:classes.warrior',
      choices: { talent: [{ option: 'test-pack:talents.tough', state: { uses: 0 } }] },
      grants: { 'test-pack:wards.ward': { state: { charges: 0 } } },
    });
    expect(result.followUps).toEqual([]);
  });
});
