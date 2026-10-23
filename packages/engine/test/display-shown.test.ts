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
