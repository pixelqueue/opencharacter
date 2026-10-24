import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

const pack = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.2.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    families: { school: ['fire', 'ice', 'stone'] },
    fields: {
      'ranks.{school}': { type: 'integer', input: true, default: 0 },
      power: { type: 'integer', formula: 0 },
      known: { type: 'set', of: 'string' },
    },
    contentTypes: {
      feature: {},
      spell: {
        fields: { school: { type: 'string', required: true }, core: { type: 'boolean' } },
        state: { rank: { type: 'integer', default: 0 } },
        effects: [
          { target: 'power', op: 'add', value: 'self.rank' },
          { target: 'power', op: 'add', value: 'self.rank * 10', scope: 'applied' },
        ],
      },
      focus: {},
      condition: {},
    },
  },
  content: [
    { id: 'spells.flame', type: 'spell', fields: { school: 'fire', core: true } },
    { id: 'spells.spark', type: 'spell', fields: { school: 'fire', core: false } },
    { id: 'spells.frost', type: 'spell', fields: { school: 'ice', core: true } },
    { id: 'spells.quake', type: 'spell', fields: { school: 'stone', core: true } },
    {
      id: 'foci.focus',
      type: 'focus',
      choices: [
        {
          id: 'school',
          from: { values: ['fire', 'ice', 'stone'] },
          effects: [{ target: 'known', op: 'grant', value: { formula: 'pick.value' } }],
        },
      ],
    },
    // Each school with a rank grants its core spell, ranked as the school.
    {
      id: 'features.adept',
      type: 'feature',
      grants: [
        {
          forEach: "keysOf('school')",
          when: "fieldOf('ranks.{school}', x) > 0",
          item: { query: { type: 'spell', where: 'item.core && item.school == x' } },
          state: { rank: "fieldOf('ranks.{school}', x)" },
        },
      ],
    },
    // A content-only query, resolved at load: every core spell.
    {
      id: 'features.archmage',
      type: 'feature',
      grants: [{ item: { query: { type: 'spell', where: 'item.core' } }, state: { rank: '1' } }],
    },
    // A focus per school, its choice preset to the element.
    {
      id: 'features.foci',
      type: 'feature',
      grants: [
        {
          forEach: "['ice', 'stone']",
          item: 'foci.focus',
          choices: { school: [{ option: { formula: 'x' } }] },
        },
      ],
    },
    // A list that fails grants nothing.
    {
      id: 'features.broken',
      type: 'feature',
      grants: [{ forEach: "[fieldOf('ranks.{school}', 'air')]", item: 'spells.flame' }],
    },
    // An applied grant per element.
    {
      id: 'conditions.burning',
      type: 'condition',
      grants: [
        {
          forEach: "['fire']",
          scope: 'applied',
          item: { query: { type: 'spell', where: 'item.school == x && !item.core' } },
          state: { rank: '5' },
        },
      ],
    },
  ],
} as unknown as PackRelease;

const loaded = loadRuleset([pack]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

function character(extra: Partial<CharacterDoc>): CharacterDoc {
  return {
    specVersion: '0.2.0',
    id: 'test',
    packs: [{ id: 'test-pack', version: '1.0.0' }],
    ...extra,
  };
}

describe('a grant per element', () => {
  it('grants per family key by query, with state from the key', () => {
    const sheet = computeSheet(
      ruleset,
      character({
        values: { 'test-pack:ranks.fire': 2, 'test-pack:ranks.stone': 3 },
        features: [{ id: 'adept', item: 'test-pack:features.adept' }],
      }),
    );
    expect(sheet.errors).toEqual([]);
    expect(sheet.values['test-pack:power']?.value).toBe(5);
  });

  it('resolves a content-only query at load', () => {
    expect(Object.values(ruleset.queries)).toContainEqual([
      'test-pack:spells.flame',
      'test-pack:spells.frost',
      'test-pack:spells.quake',
    ]);
    const sheet = computeSheet(
      ruleset,
      character({ features: [{ id: 'arch', item: 'test-pack:features.archmage' }] }),
    );
    expect(sheet.values['test-pack:power']?.value).toBe(3);
  });

  it('presets a choice from the element', () => {
    const sheet = computeSheet(
      ruleset,
      character({ features: [{ id: 'foci', item: 'test-pack:features.foci' }] }),
    );
    expect(sheet.values['test-pack:known']?.value).toEqual(['ice', 'stone']);
    expect(sheet.pending).toEqual([]);
  });

  it('grants nothing for a list that fails, with its error', () => {
    const sheet = computeSheet(
      ruleset,
      character({ features: [{ id: 'broken', item: 'test-pack:features.broken' }] }),
    );
    expect(sheet.errors.map((e) => [e.code, (e.data as { where: string }).where])).toEqual([
      ['no-such-key', 'test-pack:features.broken grant forEach'],
    ]);
    expect(sheet.values['test-pack:power']?.value).toBe(0);
  });

  it('follows an applied grant per element', () => {
    const sheet = computeSheet(
      ruleset,
      character({
        applied: [{ id: 'burn', source: 'test-pack:conditions.burning' }],
      } as Partial<CharacterDoc>),
    );
    expect(sheet.errors).toEqual([]);
    expect(sheet.values['test-pack:power']?.value).toBe(50);
  });
});
