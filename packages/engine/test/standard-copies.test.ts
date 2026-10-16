import { describe, expect, it } from 'vitest';
import { applyChanges, computeSheet, listOptions, loadRuleset, startAction } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

const pack = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.1.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    tags: ['standard', 'kit'],
    standardCopies: [{ type: 'trait' }],
    contentTypes: {
      trait: {},
      gear: {
        carried: true,
        equippable: true,
        state: { lit: { type: 'boolean', default: false } },
        actions: [
          {
            id: 'light',
            steps: [
              {
                id: 'light',
                kind: 'changes',
                to: 'self',
                changes: [{ type: 'setState', entry: 'self', key: 'lit', value: true }],
              },
            ],
          },
        ],
      },
    },
  },
  content: [
    // The trait is a standard copy, and gives the kit gear as its own standard copies.
    {
      id: 'traits.prepared',
      type: 'trait',
      standardCopies: [{ type: 'gear', where: "'kit' in item.tags" }],
    },
    {
      id: 'gear.lamp',
      type: 'gear',
      tags: ['kit'],
      choices: [{ id: 'colour', pick: { min: 0, max: 1 }, from: { values: ['red', 'blue'] } }],
    },
  ],
} as unknown as PackRelease;

const loaded = loadRuleset([pack]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const character: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
};
const lamp = 'test-pack-gear-lamp';

describe('standard copies', () => {
  it("adds an active standard copy's own standard copies", () => {
    expect(computeSheet(ruleset, character).standardCopies).toEqual([
      { entry: 'test-pack-traits-prepared', item: 'test-pack:traits.prepared', saved: false },
      { entry: lamp, item: 'test-pack:gear.lamp', saved: false },
    ]);
  });

  it('runs an action on an unsaved copy, and applying it writes the copy', () => {
    const result = startAction(ruleset, character, {
      action: { id: 'test-pack:gear.lamp#light', entry: lamp },
    });
    if (!('status' in result)) throw new Error(JSON.stringify(result.errors));
    expect(result.status).toBe('finished');
    const changes = (
      result as unknown as { proposedChanges: { change: never }[] }
    ).proposedChanges.map((p) => p.change);
    const applied = applyChanges(ruleset, character, changes);
    expect(applied.ok && applied.character.inventory).toEqual([
      { id: lamp, item: 'test-pack:gear.lamp', state: { lit: true } },
    ]);
  });

  it("lists and takes a pick on an unsaved copy's choice", () => {
    const path = { entry: lamp, choice: ['colour'] };
    const options = listOptions(ruleset, character, path);
    expect('options' in options && options.options.map((o) => o.option)).toEqual(['red', 'blue']);
    const picked = applyChanges(ruleset, character, [{ type: 'choose', path, option: 'red' }]);
    expect(picked.ok && picked.character.inventory).toEqual([
      { id: lamp, item: 'test-pack:gear.lamp', choices: { colour: [{ option: 'red' }] } },
    ]);
    // Unpicking leaves the copy at its defaults, so it leaves the file again.
    const back = picked.ok
      ? applyChanges(ruleset, picked.character, [{ type: 'unchoose', path, option: 'red' }])
      : picked;
    expect(back.ok && back.character.inventory).toEqual([]);
  });
});
