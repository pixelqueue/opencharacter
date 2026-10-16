import { describe, expect, it } from 'vitest';
import { applyChanges, computeSheet, listOptions, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

const pack = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.1.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
    hides: ['test-pack:tools.lens'],
  },
  rules: {
    links: {
      crew: { fields: { 'members.dotRatings': { type: 'set', of: 'string', default: [] } } },
    },
    fields: {
      level: { type: 'integer', input: true, default: 1 },
      picked: { type: 'set', of: 'string' },
      tools: { type: 'set', of: 'tool' },
    },
    contentTypes: { tool: {} },
    choices: [
      {
        id: 'dots',
        pick: { min: 0, max: 2 },
        required: false,
        from: { values: { formula: 'has(links.crew) ? links.crew.members.dotRatings : []' } },
        effects: [{ target: 'picked', op: 'grant', value: { formula: 'pick.value' } }],
      },
      {
        id: 'numbers',
        pick: { min: 0, max: 3 },
        required: false,
        // 10 / (value - 2) fails for 2, so 2 is not eligible.
        from: { values: [1, 2, 3], where: '10 / (value - 2) > 0' },
      },
      {
        id: 'tools',
        pick: { min: 0, max: 2 },
        required: false,
        activate: false,
        from: { type: 'tool' },
        effects: [{ target: 'tools', op: 'grant', value: { formula: 'pick.id' } }],
      },
    ],
  },
  content: [
    {
      id: 'tools.anvil',
      type: 'tool',
      prerequisites: [{ id: 'strong', when: 'level >= 5' }],
    },
    { id: 'tools.lens', type: 'tool' },
  ],
} as unknown as PackRelease;

const loaded = loadRuleset([pack]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const character: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  links: { 'test-pack:crew': 'the-crew' },
};
const links = {
  'test-pack:crew': { id: 'the-crew', values: { 'members.dotRatings': ['hunt', 'prowl'] } },
};

describe('choices over values', () => {
  it("picks a value the formula lists, and rejects one it doesn't", () => {
    const path = { choice: ['dots'] };
    const ok = applyChanges(
      ruleset,
      character,
      [{ type: 'choose', path, option: 'hunt' }],
      false,
      links,
    );
    expect(ok.ok && ok.character.choices).toEqual({ dots: [{ option: 'hunt' }] });
    const bad = applyChanges(
      ruleset,
      character,
      [{ type: 'choose', path, option: 'wreck' }],
      false,
      links,
    );
    expect(!bad.ok && bad.errors.map((e) => e.code)).toEqual(['invalid-option']);
  });

  it('offers nothing from a computed list without the link', () => {
    const options = listOptions(ruleset, { ...character, links: {} }, { choice: ['dots'] });
    expect('options' in options && options.options).toEqual([]);
  });

  it('treats a `where` that fails to evaluate as not eligible', () => {
    const options = listOptions(ruleset, character, { choice: ['numbers'] }, links);
    expect('options' in options && options.options.map((o) => [o.option, o.eligible])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
  });
});

describe('picks that are not activated', () => {
  it("doesn't check the picked content's prerequisites", () => {
    const options = listOptions(ruleset, character, { choice: ['tools'] }, links);
    expect('options' in options && options.options.map((o) => [o.option, o.eligible])).toEqual([
      ['test-pack:tools.anvil', true],
    ]);
  });

  it('reports a hidden pick, and runs the choice effects per pick', () => {
    const sheet = computeSheet(
      ruleset,
      {
        ...character,
        choices: {
          tools: [{ option: 'test-pack:tools.anvil' }, { option: 'test-pack:tools.lens' }],
        },
      },
      [],
      links,
    );
    expect(sheet.values['test-pack:tools']?.value).toEqual([
      'test-pack:tools.anvil',
      'test-pack:tools.lens',
    ]);
    // A hidden item matches no query, so it is also not eligible.
    expect(sheet.issues.map((i) => [i.code, i.id])).toEqual([
      ['option-not-eligible', 'rules/tools'],
      ['content-hidden', 'test-pack:tools.lens'],
    ]);
  });
});
