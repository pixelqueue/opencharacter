import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

// `picksOf` reads the choices of the formula's owner: picked content its own nested choices,
// granted content and templates theirs under prefixed keys, and a choice's saved picks whether or
// not it applies.
const pack = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.1.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    fields: {
      picked: { type: 'integer', formula: 0 },
      granted: { type: 'integer', formula: 0 },
      templated: { type: 'integer', formula: 0 },
      late: { type: 'integer', formula: 0 },
      own: { type: 'integer', formula: 0 },
    },
    contentTypes: { class: {}, subclass: {}, feat: {}, template: {} },
  },
  content: [
    {
      id: 'classes.fighter',
      type: 'class',
      grants: [{ item: 'feats.bonus' }],
      effects: [
        { target: 'own', op: 'add', value: "size(picksOf('subclass'))" },
        { target: 'late', op: 'add', value: "size(picksOf('later'))" },
      ],
      choices: [
        { id: 'subclass', from: { type: 'subclass' } },
        { id: 'later', when: false, from: { values: ['x', 'y'] } },
      ],
    },
    {
      id: 'subclasses.champion',
      type: 'subclass',
      effects: [{ target: 'picked', op: 'add', value: "size(picksOf('style'))" }],
      choices: [{ id: 'style', pick: 2, from: { values: ['x', 'y'] } }],
    },
    {
      id: 'feats.bonus',
      type: 'feat',
      effects: [{ target: 'granted', op: 'add', value: "size(picksOf('skill'))" }],
      choices: [{ id: 'skill', from: { values: ['p', 'q'] } }],
    },
    {
      id: 'templates.runed',
      type: 'template',
      appliesTo: { type: 'class' },
      effects: [{ target: 'templated', op: 'add', value: "size(picksOf('rune'))" }],
      choices: [{ id: 'rune', from: { values: ['fire', 'ice'] } }],
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
  features: [
    {
      id: 'fighter',
      item: 'test-pack:classes.fighter',
      templates: ['test-pack:templates.runed'],
      choices: {
        subclass: [
          {
            option: 'test-pack:subclasses.champion',
            choices: { style: [{ option: 'x' }, { option: 'y' }] },
          },
        ],
        later: [{ option: 'x' }],
        'test-pack:feats.bonus/skill': [{ option: 'p' }],
        'test-pack:templates.runed/rune': [{ option: 'ice' }],
      },
    },
  ],
};

describe('picksOf', () => {
  const values = computeSheet(ruleset, character).values;
  const value = (field: string) => values[`test-pack:${field}`]?.value;

  it("reads the copy's own choices", () => {
    expect(value('own')).toBe(1);
  });

  it("reads picked content's nested choices", () => {
    expect(value('picked')).toBe(2);
  });

  it("reads granted content's and a template's choices under their prefixed keys", () => {
    expect(value('granted')).toBe(1);
    expect(value('templated')).toBe(1);
  });

  it("reads a choice's saved picks even when it doesn't apply", () => {
    expect(value('late')).toBe(1);
  });
});
