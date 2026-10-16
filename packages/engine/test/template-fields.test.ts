import { describe, expect, it } from 'vitest';
import { buildRelease, computeSheet, diceFrom, loadRuleset, startAction } from '../src/index.ts';
import type { CharacterDoc, PackRelease, PackSource } from '../src/index.ts';

const manifest = {
  id: 'test-pack',
  version: '1.0.0',
  specVersion: '0.1.0',
  license: 'CC0-1.0',
  defaultLanguage: 'en',
};

const source = {
  manifest,
  rules: [
    {
      templateFields: { bonus: { type: 'integer', default: 0 } },
      contentTypes: {
        gear: {
          carried: true,
          fields: { kind: { type: 'enum', values: ['arrow', 'bow'] } },
          computed: {
            pairs: { type: 'string', formula: "has(item.pairsWith) ? item.pairsWith : ''" },
          },
          actions: [{ use: 'shoot' }],
        },
      },
      actions: [
        {
          id: 'shoot',
          available: "item.kind == 'bow'",
          steps: [
            {
              id: 'ammo',
              kind: 'choice',
              options: {
                copies: { type: 'gear', where: "item.kind == 'arrow' && self.quantity > 0" },
              },
              prefer: 'item.bonus',
              changes: [{ type: 'adjustQuantity', entry: 'picked', by: -1 }],
            },
            {
              id: 'attack',
              kind: 'roll',
              parts: [
                { dice: '1d20' },
                { value: 'steps.ammo.item.bonus', when: 'has(steps.ammo)' },
              ],
            },
          ],
        },
      ],
    },
    { templateFields: { pairsWith: { type: 'id', of: 'gear' } } },
  ],
  content: [
    { id: 'gear.arrow', type: 'gear', fields: { kind: 'arrow' } },
    { id: 'gear.bow', type: 'gear', fields: { kind: 'bow' } },
    {
      id: 'keen',
      type: 'template',
      appliesTo: { type: 'gear', where: "item.kind == 'arrow'" },
      fields: { bonus: 2, pairsWith: 'gear.bow' },
    },
  ],
} as unknown as PackSource;

const release: PackRelease = buildRelease(source);
const loaded = loadRuleset([release]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const character = {
  specVersion: '0.1.0',
  id: 'tester',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  inventory: [
    { id: 'bow-1', item: 'test-pack:gear.bow' },
    { id: 'arrows', item: 'test-pack:gear.arrow', quantity: 10 },
    { id: 'keen-arrows', item: 'test-pack:gear.arrow', quantity: 3, templates: ['test-pack:keen'] },
  ],
} as unknown as CharacterDoc;

describe('template fields', () => {
  it('are merged across a pack’s rules documents by the build', () => {
    expect(Object.keys(release.rules.templateFields ?? {})).toEqual(['bonus', 'pairsWith']);
  });

  it('qualify an id value in the template’s pack', () => {
    const sheet = computeSheet(ruleset, character);
    expect(sheet.copies['keen-arrows']).toEqual({ pairs: 'test-pack:gear.bow' });
    expect(sheet.copies['arrows']).toEqual({ pairs: '' });
  });

  it('are read from a copy picked by a choice step', () => {
    const result = startAction(
      ruleset,
      character,
      { action: { id: 'test-pack:shoot', entry: 'bow-1' } },
      diceFrom([12]),
    );
    if (!('status' in result)) throw new Error(JSON.stringify(result.errors));
    expect(result.status).toBe('finished');
    // The keen arrows are preferred (bonus 2) and spent; their bonus joins the roll.
    const changes = (result as unknown as { proposedChanges: { change: unknown }[] })
      .proposedChanges;
    expect(changes.map((p) => p.change)).toEqual([
      { type: 'adjustQuantity', entry: 'keen-arrows', by: -1 },
    ]);
    const attack = (result.log as { step: string; total?: number }[]).find(
      (l) => l.step === 'attack',
    );
    expect(attack?.total).toBe(14);
  });
});
