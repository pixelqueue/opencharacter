import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

// `picksOf('rules', choice)` reads a rules-level choice where a formula has no owner, and
// `countPicks` nests in another aggregate, bound per outer element.
const pack = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.2.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    contentTypes: {
      crewType: { fields: { upgrades: { type: 'set', of: 'field', default: [] } } },
      claim: {},
    },
    fields: {
      'upgrades.boat': { type: 'integer', input: true, default: 0, tags: ['special'] },
      'upgrades.maps': { type: 'integer', input: true, default: 0, tags: ['special'] },
      others: {
        type: 'integer',
        formula:
          "sumFields(countPicks(pick.type == 'crewType' && f.id in pick.fields.upgrades) > 0 ? 0 : f.value, 'special' in f.tags)",
      },
      held: {
        type: 'integer',
        formula: 'countCopies(countPicks(pick.item == copy.item) > 0)',
      },
    },
    choices: [
      { id: 'crew-type', pick: { min: 0, max: 1 }, required: false, from: { type: 'crewType' } },
      { id: 'claims', pick: { min: 0, max: 2 }, required: false, from: { type: 'claim' } },
    ],
    constraints: [
      {
        id: 'special-upgrades',
        check:
          "size(picksOf('rules', 'crew-type')) == 0 || sumFields(f.id in itemField(picksOf('rules', 'crew-type')[0], 'upgrades') ? 0 : f.value, 'special' in f.tags) == 0",
      },
    ],
  },
  content: [
    { id: 'crew-types.smugglers', type: 'crewType', fields: { upgrades: ['upgrades.boat'] } },
    { id: 'claims.docks', type: 'claim' },
    { id: 'claims.tavern', type: 'claim' },
  ],
} as unknown as PackRelease;

const loaded = loadRuleset([pack]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

function sheet(values: Record<string, number>, crew: boolean) {
  const character: CharacterDoc = {
    specVersion: '0.2.0',
    id: 'test',
    packs: [{ id: 'test-pack', version: '1.0.0' }],
    choices: {
      'crew-type': crew ? [{ option: 'test-pack:crew-types.smugglers' }] : [],
      claims: [{ option: 'test-pack:claims.docks' }],
    },
    inventory: [
      { id: 'a', item: 'test-pack:claims.docks' },
      { id: 'b', item: 'test-pack:claims.tavern' },
    ],
    values: Object.fromEntries(Object.entries(values).map(([k, v]) => [`test-pack:${k}`, v])),
  } as unknown as CharacterDoc;
  const result = computeSheet(loaded.ok ? loaded.ruleset : (undefined as never), character);
  expect(result.errors).toEqual([]);
  return result;
}

describe('rules-level picks and nested pick aggregates', () => {
  it("reads the picked crew type's upgrades in a constraint", () => {
    const issues = (s: ReturnType<typeof sheet>) =>
      s.issues.map((i) => ('id' in i ? i.id : undefined));
    expect(issues(sheet({ 'upgrades.boat': 1 }, true))).not.toContain('test-pack:special-upgrades');
    expect(issues(sheet({ 'upgrades.maps': 1 }, true))).toContain('test-pack:special-upgrades');
    expect(issues(sheet({ 'upgrades.maps': 1 }, false))).not.toContain(
      'test-pack:special-upgrades',
    );
  });

  it('binds countPicks per outer element', () => {
    const s = sheet({ 'upgrades.boat': 2, 'upgrades.maps': 3 }, true);
    expect(s.values['test-pack:others']?.value).toBe(3);
    expect(s.values['test-pack:held']?.value).toBe(1);
  });
});
