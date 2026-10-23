import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildRelease, computeSheet, loadRuleset, startAction } from '../src/index.ts';
import type { CharacterDoc, PackSource } from '../src/index.ts';
import { readPack } from './packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const loaded = loadRuleset([readPack(`${root}packages/spec/tests/packs/test-kept-sources`)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const character = (extra: Partial<CharacterDoc>): CharacterDoc => ({
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-kept-sources', version: '0.1.0' }],
  features: [{ id: 'connection', item: 'test-kept-sources:features.connection' }],
  ...extra,
});
const weapon = (element: string, active = true) => ({
  id: 'weapon',
  source: 'test-kept-sources:boons.elemental-weapon',
  state: { element },
  ...(active ? {} : { active: false }),
});
const frost = (c: CharacterDoc) =>
  computeSheet(ruleset, c).templated.find((t) => t.item === 'test-kept-sources:spells.frost');

describe('kept template params from applied entries', () => {
  it('takes the damage type from the applied entry', () => {
    expect(frost(character({ applied: [weapon('acid')] }))?.fields.damageType).toBe('acid');
  });

  it('keeps nothing while no elemental weapon is active', () => {
    expect(frost(character({}))).toBeUndefined();
    expect(frost(character({ applied: [weapon('fire', false)] }))).toBeUndefined();
  });

  it('leaves an enum field as it was when the formula gives none of its values', () => {
    const sheet = computeSheet(ruleset, character({ applied: [weapon('lightning')] }));
    const merged = sheet.templated.find((t) => t.item === 'test-kept-sources:spells.frost');
    expect(merged?.fields.damageType).toBe('cold');
    expect(sheet.errors).toEqual([]);
  });

  it("the spell's action reads the merged damage type", () => {
    const run = startAction(ruleset, character({ applied: [weapon('fire')] }), {
      action: {
        id: 'test-kept-sources:cast',
        entry: 'connection',
        source: 'test-kept-sources:spells.frost',
      },
    });
    if (!('status' in run) || run.status !== 'finished') throw new Error(JSON.stringify(run));
    expect(run.outcome.data).toEqual({ range: 60, damageType: 'fire' });
  });
});

const pack = (fields: Record<string, unknown>) =>
  ({
    manifest: {
      id: 'p',
      version: '1.0.0',
      specVersion: '0.1.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: [
      {
        fields: { element: { type: 'string', input: true, default: 'fire' } },
        contentTypes: {
          spell: {
            fields: {
              kind: { type: 'enum', values: ['fire', 'cold'], default: 'cold' },
              range: { type: 'integer', default: 0 },
            },
          },
        },
      },
    ],
    content: [
      { id: 'spells.ray', type: 'spell' },
      { id: 'templates.t', type: 'template', appliesTo: { type: 'spell' }, fields },
    ],
  }) as unknown as PackSource;

describe('a template field given as { formula }', () => {
  it('reads input fields, as a numeric value does', () => {
    const release = buildRelease(pack({ kind: { formula: 'element' } }));
    const set = loadRuleset([release]);
    if (!set.ok) throw new Error(JSON.stringify(set.errors));
    const sheet = computeSheet(set.ruleset, {
      specVersion: '0.1.0',
      id: 'c',
      packs: [{ id: 'p', version: '1.0.0' }],
      features: [{ id: 'ray', item: 'p:spells.ray', templates: ['p:templates.t'] }],
    });
    expect(sheet.templated[0]?.fields.kind).toBe('fire');
  });

  it('must give a string', () => {
    const release = buildRelease(pack({ kind: { formula: 'range' } }));
    const set = loadRuleset([release]);
    expect(set.ok).toBe(false);
    if (set.ok) return;
    expect(set.errors.map((e) => e.data?.cause)).toEqual(['unknown-name']);
    const typed = loadRuleset([buildRelease(pack({ kind: { formula: '1 + 2' } }))]);
    expect(typed.ok ? [] : typed.errors.map((e) => e.data?.cause)).toEqual(['type-mismatch']);
  });
});

describe('templates kept per activation', () => {
  const both = character({
    features: [
      {
        id: 'warlock',
        item: 'test-kept-sources:classes.warlock',
        choices: { cantrip: [{ option: 'test-kept-sources:spells.bolt' }] },
      },
      {
        id: 'druid',
        item: 'test-kept-sources:classes.druid',
        choices: { cantrip: [{ option: 'test-kept-sources:spells.bolt' }] },
      },
      { id: 'spear', item: 'test-kept-sources:features.spear' },
    ],
  });
  const cast = (entry: string) => {
    const run = startAction(ruleset, both, {
      action: { id: 'test-kept-sources:cast', entry, source: 'test-kept-sources:spells.bolt' },
    });
    if (!('status' in run) || run.status !== 'finished') throw new Error(JSON.stringify(run));
    return run.outcome.data;
  };

  it("keeps the template on the warlock's bolt only, by the candidate's owner", () => {
    const sheet = computeSheet(ruleset, both);
    expect(sheet.templated.map((t) => [t.activation, t.fields.range])).toEqual([[1, 150]]);
    expect(sheet.activations[1]).toMatchObject({
      item: 'test-kept-sources:spells.bolt',
      entry: 'warlock',
    });
    expect(sheet.errors).toEqual([]);
  });

  it("each activation's action reads its own item", () => {
    expect(cast('warlock')).toEqual({ range: 150, damageType: 'fire' });
    expect(cast('druid')).toEqual({ range: 120, damageType: 'fire' });
  });
});

const keeper = (query: Record<string, unknown>) =>
  loadRuleset([
    buildRelease({
      manifest: {
        id: 'p',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: [
        {
          contentTypes: { spell: {} },
          choices: [{ id: 'spell', from: { type: 'spell' } }],
        },
      ],
      content: [
        { id: 'spells.ray', type: 'spell' },
        { id: 'templates.t', type: 'template', appliesTo: { type: 'spell' }, tags: [] },
        {
          id: 'features.keeper',
          type: 'spell',
          keepsTemplates: [{ template: 'templates.t', ...query }],
        },
      ],
    } as unknown as PackSource),
  ]);

describe("a kept template's owner", () => {
  it('is the rules for a rules-level pick, with no item', () => {
    const set = keeper({
      content: { type: 'spell', where: "owner.id == 'p:rules' && !has(owner.item)" },
    });
    if (!set.ok) throw new Error(JSON.stringify(set.errors));
    const sheet = computeSheet(set.ruleset, {
      specVersion: '0.1.0',
      id: 'c',
      packs: [{ id: 'p', version: '1.0.0' }],
      choices: { spell: [{ option: 'p:spells.ray' }] },
      features: [{ id: 'k', item: 'p:features.keeper' }],
    });
    expect(sheet.templated.map((t) => t.item)).toEqual(['p:spells.ray']);
  });

  it('is unbound on copies', () => {
    const set = keeper({ copies: { type: 'spell', where: "owner.id == 'p:rules'" } });
    expect(set.ok ? [] : set.errors.map((e) => e.data?.cause)).toEqual(['unknown-name']);
  });
});
