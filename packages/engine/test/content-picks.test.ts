import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

// `picksOf(content, choice)` merges over every activation of the content, a template's included,
// and reads a grant's preset picks; `grantedPicksOf` reads the saved picks of granted content.
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
      runes: { type: 'integer', formula: "size(picksOf('templates.runed', 'rune'))" },
      preset: { type: 'integer', formula: "size(picksOf('feats.style', 'style'))" },
      granted: { type: 'integer', formula: 0 },
    },
    contentTypes: { class: {}, feat: {}, template: {} },
  },
  content: [
    {
      id: 'classes.fighter',
      type: 'class',
      grants: [
        { item: 'feats.style', choices: { style: [{ option: 'parry' }] } },
        { item: 'feats.skill' },
      ],
      effects: [
        { target: 'granted', op: 'add', value: "size(grantedPicksOf('feats.skill', 'skill'))" },
      ],
    },
    {
      id: 'feats.style',
      type: 'feat',
      choices: [{ id: 'style', from: { values: ['parry', 'lunge'] } }],
    },
    { id: 'feats.skill', type: 'feat', choices: [{ id: 'skill', from: { values: ['p', 'q'] } }] },
    {
      id: 'templates.runed',
      type: 'template',
      appliesTo: { type: 'class' },
      choices: [{ id: 'rune', from: { values: ['fire', 'ice'] } }],
    },
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
      id: 'fighter',
      item: 'test-pack:classes.fighter',
      templates: ['test-pack:templates.runed'],
      choices: {
        'test-pack:templates.runed/rune': [{ option: 'ice' }],
        'test-pack:feats.skill/skill': [{ option: 'q' }],
      },
    },
  ],
};

describe('picks of other content', () => {
  const values = computeSheet(loaded.ruleset, character).values;
  const value = (field: string) => values[`test-pack:${field}`]?.value;

  it("reads a template's choice from a field formula", () => {
    expect(value('runes')).toBe(1);
  });

  it("reads a grant's preset picks", () => {
    expect(value('preset')).toBe(1);
  });

  it('reads the saved picks of content the owner grants', () => {
    expect(value('granted')).toBe(1);
  });
});
