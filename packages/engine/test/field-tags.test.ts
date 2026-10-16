import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset } from '../src/index.ts';
import { fieldSet, fieldViews } from '../src/core/views.ts';

function load() {
  const loaded = loadRuleset([
    {
      manifest: {
        id: 'test-pack',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: {
        tags: ['dc', 'attr.str', 'attr.dex'],
        fields: {
          key: { type: 'enum', values: ['str', 'dex'], input: true, default: 'str' },
          ac: { type: 'integer', formula: 10, tags: ['dc', 'attr.dex'] },
          classDc: {
            type: 'integer',
            formula: 12,
            tags: ['dc', { formula: "'attr.' + key" }],
          },
        },
        effects: [
          {
            target: { fields: { where: "'attr.dex' in item.tags" } },
            op: 'add',
            value: -1,
          },
        ],
      },
      content: [],
    } as never,
  ]);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  return loaded.ruleset;
}

const character = (key: string) => ({
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  values: { 'test-pack:key': key },
});

describe('field tags from a formula', () => {
  it('leaves computed tags out of the static view and marks the field in a set', () => {
    const ruleset = load();
    const view = fieldViews(ruleset).find((v) => v.id === 'test-pack:classDc');
    expect(view?.tags).toEqual(['dc']);
    expect(fieldSet(ruleset, "'attr.dex' in item.tags")).toEqual([
      { id: 'test-pack:ac', computed: false },
      { id: 'test-pack:classDc', computed: true },
    ]);
  });

  it('matches a set against the tags on the sheet', () => {
    const ruleset = load();
    const dex = computeSheet(ruleset, character('dex') as never);
    const str = computeSheet(ruleset, character('str') as never);
    expect(dex.values['test-pack:classDc']?.value).toBe(11);
    expect(str.values['test-pack:classDc']?.value).toBe(12);
    expect(dex.values['test-pack:ac']?.value).toBe(9);
    expect(str.values['test-pack:ac']?.value).toBe(9);
  });
});
