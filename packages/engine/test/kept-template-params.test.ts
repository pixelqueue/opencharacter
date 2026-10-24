import { describe, expect, it } from 'vitest';
import { buildRelease, computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackSource } from '../src/index.ts';

const manifest = {
  id: 'p',
  version: '1.0.0',
  specVersion: '0.1.0',
  license: 'CC0-1.0',
  defaultLanguage: 'en',
};

const source = {
  manifest,
  rules: [
    {
      fields: {
        empowered: { type: 'boolean', input: true, default: false },
        reach: { type: 'integer', formula: 0 },
      },
      contentTypes: {
        spell: {
          fields: {
            range: { type: 'integer', default: 0 },
            scale: { type: 'decimal', default: 1 },
          },
          effects: [{ target: 'reach', op: 'atLeast', value: 'item.range' }],
        },
        gear: { carried: true },
        feature: {
          fields: { step: { type: 'integer', default: 10 } },
          state: { rank: { type: 'integer', default: 1 } },
        },
      },
    },
  ],
  content: [
    { id: 'spells.flame', type: 'spell', fields: { range: 60 } },
    { id: 'spells.frost', type: 'spell', fields: { range: 30 } },
    { id: 'gear.lens', type: 'gear' },
    {
      id: 'features.casting',
      type: 'feature',
      choices: [{ id: 'spells', pick: 2, from: { type: 'spell' } }],
    },
    {
      id: 'templates.longer',
      type: 'template',
      appliesTo: { type: 'spell' },
      params: { feet: { type: 'integer', default: 0 }, times: { type: 'decimal' } },
      fields: {
        range: 'prior.range + params.feet',
        scale: 'has(params.times) ? params.times : prior.scale',
      },
    },
    // Keeps longer on its own pick while empowered (an input field), `step` per rank, and
    // scales it by an integer given to a decimal param.
    {
      id: 'features.aim',
      type: 'feature',
      fields: { step: 20 },
      choices: [{ id: 'spell', from: { type: 'spell' }, activate: false }],
      keepsTemplates: [
        {
          template: 'templates.longer',
          content: { type: 'spell', where: "empowered && item.id in picksOf('spell')" },
          params: { feet: 'item.step * self.rank', times: 2 },
        },
      ],
    },
    // Adds a lens to every character, and keeps longer on every spell by the lenses carried:
    // the lens is a standard copy found a round after the keeper, so the params change.
    {
      id: 'features.lensed',
      type: 'feature',
      standardCopies: [{ type: 'gear' }],
      keepsTemplates: [
        {
          template: 'templates.longer',
          content: { type: 'spell' },
          params: { feet: "100 * countCopies(copy.type == 'gear')" },
        },
      ],
    },
  ],
} as unknown as PackSource;

const loaded = loadRuleset([buildRelease(source)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const sheetOf = (features: object[], values: Record<string, unknown> = {}) =>
  computeSheet(ruleset, {
    specVersion: '0.1.0',
    id: 'c',
    packs: [{ id: 'p', version: '1.0.0' }],
    values,
    features: [
      {
        id: 'casting',
        item: 'p:features.casting',
        choices: { spells: [{ option: 'p:spells.flame' }, { option: 'p:spells.frost' }] },
      },
      ...features,
    ],
  } as unknown as CharacterDoc);

const aim = (rank: number, spell: string) => ({
  id: `aim-${spell}`,
  item: 'p:features.aim',
  state: { rank },
  choices: { spell: [{ option: `p:spells.${spell}` }] },
});

describe('templates kept from the keeper', () => {
  it("keep a template on the keeper's own pick, with params from its item and copy", () => {
    const sheet = sheetOf([aim(3, 'frost')], { 'p:empowered': true });
    expect(sheet.templated).toEqual([
      {
        activation: 2,
        item: 'p:spells.frost',
        templates: ['p:templates.longer'],
        tags: [],
        fields: { range: 90, scale: 2 },
      },
    ]);
    expect(sheet.values['p:reach']?.value).toBe(90);
    expect(sheet.errors).toEqual([]);
  });

  it('read input fields in the query, as an activation condition', () => {
    const sheet = sheetOf([aim(3, 'frost')]);
    expect(sheet.templated).toEqual([]);
    expect(sheet.values['p:reach']?.value).toBe(60);
  });

  it('find params again in later rounds, when what they read changes', () => {
    const sheet = sheetOf([{ id: 'lensed', item: 'p:features.lensed' }]);
    expect(sheet.templated.map((t) => t.fields.range)).toEqual([160, 130]);
    expect(sheet.values['p:reach']?.value).toBe(160);
    expect(sheet.errors).toEqual([]);
  });

  it('keep a template once per activation, with its first keeper’s params', () => {
    const sheet = sheetOf([aim(1, 'flame'), { id: 'lensed', item: 'p:features.lensed' }], {
      'p:empowered': true,
    });
    expect(sheet.templated).toEqual([
      {
        activation: 1,
        item: 'p:spells.flame',
        templates: ['p:templates.longer'],
        tags: [],
        fields: { range: 80, scale: 2 },
      },
      {
        activation: 2,
        item: 'p:spells.frost',
        templates: ['p:templates.longer'],
        tags: [],
        fields: { range: 130, scale: 1 },
      },
    ]);
  });
});
