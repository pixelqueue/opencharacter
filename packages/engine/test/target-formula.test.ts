import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

// A formula target is resolved once the effect is active; a field the op doesn't take is a sheet
// error and the effect targets nothing.
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
      score: { type: 'integer', formula: 1 },
      known: { type: 'set', of: 'string' },
      name: { type: 'string', formula: "''" },
    },
    contentTypes: { feat: {} },
  },
  content: [
    {
      id: 'feats.mixed',
      type: 'feat',
      effects: [
        { target: { formula: "'score'" }, op: 'multiply', value: 3 },
        { target: { formula: "'name'" }, op: 'add', value: 1 },
        { target: { formula: "'score'" }, op: 'grant', value: { formula: "'x'" } },
        { target: { formula: "'known'" }, op: 'grant', value: { formula: "'x'" } },
      ],
    },
  ],
} as unknown as PackRelease;

const loaded = loadRuleset([pack]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

const character: CharacterDoc = {
  specVersion: '0.2.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  features: [{ id: 'mixed', item: 'test-pack:feats.mixed' }],
};

describe('formula targets', () => {
  const sheet = computeSheet(loaded.ruleset, character);

  it('apply as if written with the field they name', () => {
    expect(sheet.values['test-pack:score']?.value).toBe(3);
    expect(sheet.values['test-pack:known']?.value).toEqual(['x']);
  });

  it("report a field the op doesn't take", () => {
    expect(sheet.errors.map((e) => e.code)).toEqual(['type-mismatch', 'type-mismatch']);
  });
});
