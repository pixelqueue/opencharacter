import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { paths } from '@opencharacter/spec/node';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset, upgrade } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';
import { readPack } from './packs.ts';

const root = resolve(paths.root, '..', '..');

function pack(version: string, rules: object, content: object[] = []): PackRelease {
  return {
    manifest: {
      id: 'test-pack',
      version,
      specVersion: '0.1.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules,
    content,
  } as never;
}

function load(...packs: PackRelease[]) {
  const loaded = loadRuleset(packs);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  return loaded.ruleset;
}

const character = (version = '1.0.0', extra: object = {}): CharacterDoc =>
  ({ specVersion: '0.1.0', id: 'test', packs: [{ id: 'test-pack', version }], ...extra }) as never;

const option = (id: string, state?: object) => ({ option: `test-pack:spells.${id}`, state });

describe('display visibility', { timeout: 30_000 }, () => {
  it('binds the copy aggregates in showWhen (orc-2e prey.target)', () => {
    const orc = load(readPack(join(root, 'packs', 'orc/2e')));
    const read = (file: string) =>
      parse(readFileSync(join(root, 'examples', 'characters', file), 'utf8')) as CharacterDoc;
    expect(computeSheet(orc, read('orc-wren.yaml')).values['orc-2e:prey.target']?.shown).toBe(true);
    expect(computeSheet(orc, read('orc-aldric.yaml')).values['orc-2e:prey.target']?.shown).toBe(
      false,
    );
  });

  it('counts a failing condition as shown and a failing where as no match', () => {
    const r = load(
      pack('1.0.0', {
        fields: {
          a: { type: 'integer', input: true },
          c: { type: 'integer', input: true },
        },
        display: {
          groups: [
            { id: 'odd', showWhen: '1 / 0 > 0', members: { type: 'field', where: '1 / 0 > 0' } },
          ],
          fields: { a: { showWhen: 'a / 0 > 0' }, c: { groups: ['odd'] } },
        },
      }),
    );
    const sheet = computeSheet(r, character());
    expect(sheet.values['test-pack:a']?.shown).toBe(true);
    expect(sheet.values['test-pack:c']?.shown).toBe(true);
    expect(sheet.groups).toEqual([{ id: 'odd', shown: true, fields: ['test-pack:c'] }]);
    expect(sheet.errors).toEqual([]);
  });

  it('matches members against computed tags and character values on each sheet', () => {
    const r = load(
      pack('1.0.0', {
        tags: ['hot', 'big'],
        fields: {
          heat: { type: 'integer', input: true },
          size: { type: 'integer', input: true },
          ember: {
            type: 'integer',
            input: true,
            tags: [{ formula: "heat > 0 ? ['hot'] : []" }],
          },
          stone: { type: 'integer', input: true },
        },
        display: {
          groups: [
            { id: 'hot', members: { type: 'field', where: "'hot' in item.tags" } },
            { id: 'big', members: { type: 'field', where: 'size > 5' }, showWhen: 'size > 9' },
          ],
        },
      }),
    );
    const cold = computeSheet(r, character());
    expect(cold.groups).toEqual([
      { id: 'hot', shown: true, fields: [] },
      { id: 'big', shown: false, fields: [] },
    ]);
    const hot = computeSheet(r, character('1.0.0', { values: { 'test-pack:heat': 1 } }));
    expect(hot.groups[0]).toEqual({ id: 'hot', shown: true, fields: ['test-pack:ember'] });
    const big = computeSheet(r, character('1.0.0', { values: { 'test-pack:size': 6 } }));
    expect(big.groups[1]?.fields).toEqual([
      'test-pack:heat',
      'test-pack:size',
      'test-pack:ember',
      'test-pack:stone',
    ]);
    expect(big.values['test-pack:stone']?.shown).toBe(false);
  });

  it('lists picks as content members and their state keys not shown', () => {
    const r = load(
      pack(
        '1.0.0',
        {
          contentTypes: {
            class: { carried: false, state: { level: { type: 'integer', default: 1 } } },
            spell: {
              carried: false,
              fields: { level: { type: 'integer', default: 1 } },
              state: { prepared: { type: 'boolean', default: false } },
            },
          },
          display: {
            groups: [
              {
                id: 'spells',
                kind: 'content',
                members: { type: 'spell' },
                sectionBy: 'item.level == 9 ? floor(1 / 0) : item.level',
                sortBy: 'self.prepared ? 0 : self.level > 1 ? 2 : 1 / 0',
              },
            ],
            types: {
              spell: { state: { prepared: { showWhen: 'item.level > 0 && self.level > 1' } } },
            },
          },
        },
        [
          {
            id: 'classes.wizard',
            type: 'class',
            choices: [{ id: 'spells', pick: 5, from: { type: 'spell' } }],
          },
          { id: 'spells.a', type: 'spell', fields: { level: 0 } },
          { id: 'spells.b', type: 'spell' },
          { id: 'spells.c', type: 'spell' },
          { id: 'spells.d', type: 'spell', fields: { level: 9 } },
        ],
      ),
    );
    const picks = [option('a'), option('b'), option('c', { prepared: true }), option('d')];
    const wizard = (level: number) =>
      computeSheet(
        r,
        character('1.0.0', {
          features: [
            {
              id: 'wiz',
              item: 'test-pack:classes.wizard',
              state: { level },
              choices: { spells: picks },
            },
          ],
        }),
      );
    const low = wizard(1);
    expect(low.activations.map((a) => [a.item, a.hiddenState])).toEqual([
      ['test-pack:classes.wizard', undefined],
      ['test-pack:spells.a', ['prepared']],
      ['test-pack:spells.b', ['prepared']],
      ['test-pack:spells.c', ['prepared']],
      ['test-pack:spells.d', ['prepared']],
    ]);
    // a in section 0; b and c in section 1, c first (sorted 0), b's sortBy failing; d's
    // failing sectionBy last.
    expect(low.groups[0]?.items).toEqual([
      { activation: 1, section: 0 },
      { activation: 3, section: 1 },
      { activation: 2, section: 1 },
      { activation: 4 },
    ]);
    const high = wizard(2);
    expect(high.activations[2]?.hiddenState).toBeUndefined();
    expect(high.activations[1]?.hiddenState).toEqual(['prepared']);
    // At level 2 b's sortBy is 2, after c's 0.
    expect(high.groups[0]?.items?.slice(1, 3)).toEqual([
      { activation: 3, section: 1 },
      { activation: 2, section: 1 },
    ]);
    expect(high.errors).toEqual([]);
  });

  it('gives an unlisted applied entry its state keys not shown, and hides an action group', () => {
    const r = load(
      pack(
        '1.0.0',
        {
          tags: ['attack'],
          contentTypes: {
            weapon: { carried: true },
            condition: { carried: false, state: { by: { type: 'string', default: '' } } },
          },
          actions: [{ id: 'swing', tags: ['attack'], steps: [{ id: 'done', kind: 'outcome' }] }],
          display: {
            groups: [
              {
                id: 'attacks',
                kind: 'actions',
                showWhen: 'countCopies(copy.item == @weapons.axe) > 0',
                members: { type: 'action', where: "'attack' in item.tags" },
              },
              {
                id: 'conditions',
                kind: 'content',
                members: { type: 'condition', from: 'applied' },
              },
            ],
            types: { condition: { state: { by: { showWhen: "self.by != ''" } } } },
          },
        },
        [
          { id: 'weapons.axe', type: 'weapon' },
          { id: 'conditions.dazed', type: 'condition' },
        ],
      ),
    );
    const sheet = computeSheet(
      r,
      character('1.0.0', {
        applied: [
          { id: 'd1', source: 'test-pack:conditions.dazed', active: false },
          { id: 'd2', source: 'test-pack:conditions.dazed', state: { by: 'ogre' } },
        ],
      }),
    );
    expect(sheet.groups).toEqual([
      { id: 'attacks', shown: false, actions: [0] },
      {
        id: 'conditions',
        shown: true,
        items: [
          { entry: 'd1', hiddenState: ['by'] },
          { entry: 'd2', activation: 0 },
        ],
      },
    ]);
    expect(sheet.activations[0]?.hiddenState).toBeUndefined();
    const armed = computeSheet(
      r,
      character('1.0.0', { inventory: [{ id: 'axe', item: 'test-pack:weapons.axe' }] }),
    );
    expect(armed.groups[0]).toEqual({ id: 'attacks', shown: true, actions: [0] });
  });

  it('reports shownBefore and shownAfter, each with its side', () => {
    const from = load(
      pack('1.0.0', {
        fields: {
          might: { type: 'integer', input: true, default: 1 },
          helper: { type: 'integer', formula: 'might + 1' },
        },
        display: { fields: { helper: { hidden: true } } },
      }),
    );
    const to = load(pack('2.0.0', { fields: { might: { type: 'integer', input: true } } }));
    const result = upgrade(from, to, character());
    expect(result.ok && result.report.values).toEqual([
      { field: 'test-pack:helper', before: 2, shownBefore: false },
      { field: 'test-pack:might', before: 1, after: 0, shownBefore: true, shownAfter: true },
    ]);
  });
});
