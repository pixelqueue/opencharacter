import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

// `countPicks` and `countGrants` see each pick's or grant's state with its defaults: a grant's
// `state` value before the declared default, and a pick nested under another pick.
const pack = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.2.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    fields: {
      charged: { type: 'integer', formula: 'countGrants(grant.state.charges > 0)' },
      nested: { type: 'integer', formula: "countPicks(pick.type == 'style')" },
      unused: { type: 'integer', formula: "countPicks(pick.type == 'feat' && !pick.state.used)" },
    },
    contentTypes: {
      class: {},
      feat: { state: { used: { type: 'boolean', default: false } } },
      style: {},
      ward: { state: { charges: { type: 'integer', default: 0 } } },
    },
  },
  content: [
    {
      id: 'classes.warden',
      type: 'class',
      choices: [{ id: 'feat', from: { type: 'feat' } }],
      grants: [{ item: 'wards.ward', state: { charges: 2 } }, { item: 'wards.spent' }],
    },
    { id: 'feats.duelist', type: 'feat', choices: [{ id: 'style', from: { type: 'style' } }] },
    { id: 'styles.riposte', type: 'style' },
    { id: 'wards.ward', type: 'ward' },
    { id: 'wards.spent', type: 'ward' },
  ],
} as unknown as PackRelease;

const loaded = loadRuleset([pack]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

const character: CharacterDoc = {
  specVersion: '0.2.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  features: [
    {
      id: 'warden',
      item: 'test-pack:classes.warden',
      choices: {
        feat: [
          {
            option: 'test-pack:feats.duelist',
            choices: { style: [{ option: 'test-pack:styles.riposte' }] },
          },
        ],
      },
    },
  ],
};

describe('countPicks and countGrants', () => {
  const values = computeSheet(loaded.ruleset, character).values;
  const value = (field: string) => values[`test-pack:${field}`]?.value;

  it("reads a grant's `state` value before the declared default", () => {
    expect(value('charged')).toBe(1);
  });

  it('goes over nested picks, and reads declared defaults of unsaved state', () => {
    expect(value('nested')).toBe(1);
    expect(value('unused')).toBe(1);
  });
});
