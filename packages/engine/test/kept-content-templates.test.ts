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
      tags: ['far', 'divine'],
      fields: {
        focused: { type: 'boolean', input: true, default: false },
        reach: { type: 'integer', formula: 0 },
        price: { type: 'integer', formula: 0 },
      },
      contentTypes: {
        spell: {
          fields: {
            range: { type: 'integer', default: 0 },
            cost: { type: 'integer', default: 0 },
            school: { type: 'enum', values: ['fire', 'ice'] },
          },
          effects: [
            { target: 'reach', op: 'atLeast', value: 'item.range' },
            { target: 'price', op: 'add', value: 'item.cost' },
          ],
        },
        feature: {},
      },
    },
  ],
  content: [
    { id: 'spells.flame', type: 'spell', fields: { range: 60, cost: 5, school: 'fire' } },
    { id: 'spells.frost', type: 'spell', fields: { range: 30, cost: 5, school: 'ice' } },
    {
      id: 'features.casting',
      type: 'feature',
      choices: [{ id: 'spells', pick: 2, from: { type: 'spell' } }],
    },
    {
      id: 'templates.far',
      type: 'template',
      appliesTo: { type: 'spell', where: "item.school == 'fire'" },
      tags: ['far'],
      fields: { range: 'prior.range * 2', cost: 'prior.cost + 10' },
    },
    {
      id: 'templates.plain',
      type: 'template',
      appliesTo: { type: 'spell' },
      fields: { school: null },
    },
    // Keeps far on every spell (its appliesTo admits only fire), leaving the cost alone.
    {
      id: 'features.reach',
      type: 'feature',
      keepsFields: ['cost'],
      keepsTemplates: [{ template: 'templates.far', content: { type: 'spell' } }],
    },
    // Keeps plain while focused (an input field).
    {
      id: 'features.focus',
      type: 'feature',
      keepsTemplates: [
        { template: 'templates.plain', content: { type: 'spell' }, when: 'focused' },
      ],
    },
  ],
} as unknown as PackSource;

const loaded = loadRuleset([buildRelease(source)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const sheetOf = (features: string[], values: Record<string, unknown> = {}) =>
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
      ...features.map((f) => ({ id: f, item: `p:features.${f}` })),
    ],
  } as unknown as CharacterDoc);

describe('templates kept on content without a copy', () => {
  it('leave content alone while nothing keeps them', () => {
    const sheet = sheetOf([]);
    expect(sheet.values['p:reach']?.value).toBe(60);
    expect(sheet.templated).toEqual([]);
  });

  it('merge into matching picked content, by its appliesTo, leaving keepsFields alone', () => {
    const sheet = sheetOf(['reach']);
    expect(sheet.values['p:reach']?.value).toBe(120);
    expect(sheet.values['p:price']?.value).toBe(10);
    expect(sheet.templated).toEqual([
      {
        activation: 1,
        item: 'p:spells.flame',
        templates: ['p:templates.far'],
        tags: ['far'],
        fields: { range: 120, cost: 5, school: 'fire' },
      },
    ]);
    expect(sheet.errors).toEqual([]);
  });

  it('follow their keeper’s when, and a null removes a field', () => {
    expect(sheetOf(['focus']).templated).toEqual([]);
    const sheet = sheetOf(['reach', 'focus'], { 'p:focused': true });
    expect(sheet.templated).toEqual([
      {
        activation: 1,
        item: 'p:spells.flame',
        templates: ['p:templates.far', 'p:templates.plain'],
        tags: ['far'],
        fields: { range: 120, cost: 5 },
      },
      {
        activation: 2,
        item: 'p:spells.frost',
        templates: ['p:templates.plain'],
        tags: [],
        fields: { range: 30, cost: 5 },
      },
    ]);
  });
});
