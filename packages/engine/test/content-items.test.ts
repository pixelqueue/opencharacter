import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

// `itemField` reads the item as merged at load: an `extends` parent's values and the content
// type's defaults, never a copy's templates.
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
      damage: { type: 'string', formula: "itemField('lineages.young-red', 'damageType')" },
      size: { type: 'string', formula: "itemField('lineages.young-red', 'size')" },
      tagged: { type: 'integer', formula: "size(itemTags('lineages.young-red'))" },
    },
    tags: ['chromatic'],
    contentTypes: {
      lineage: {
        fields: {
          damageType: { type: 'string' },
          size: { type: 'string', default: 'medium' },
        },
      },
    },
  },
  content: [
    { id: 'lineages.red', type: 'lineage', tags: ['chromatic'], fields: { damageType: 'fire' } },
    { id: 'lineages.young-red', extends: 'lineages.red' },
  ],
} as unknown as PackRelease;

const loaded = loadRuleset([pack]);

const character: CharacterDoc = {
  specVersion: '0.2.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
};

describe('content items in formulas', () => {
  it('reads the merged item: inherited values, type defaults and tags', () => {
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const values = computeSheet(loaded.ruleset, character).values;
    expect(values['test-pack:damage']?.value).toBe('fire');
    expect(values['test-pack:size']?.value).toBe('medium');
    expect(values['test-pack:tagged']?.value).toBe(1);
  });
});
