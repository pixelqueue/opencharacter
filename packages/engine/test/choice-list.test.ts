import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { paths } from '@opencharacter/spec/node';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { applyChanges, computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';
import { readPack } from './packs.ts';

const root = resolve(paths.root, '..', '..');
const loaded = loadRuleset(
  [
    '5e/srd-5.1',
    'mothership/1e',
    'fitd/scoundrel',
    'fitd/crew',
    'fate/core',
    'mork-borg/core',
    'orc/2e',
  ].map((dir) => readPack(join(root, 'packs', dir))),
);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;
const mothership = loadRuleset([readPack(join(root, 'packs', 'mothership/1e'))]);
if (!mothership.ok) throw new Error(JSON.stringify(mothership.errors));

describe('the choice list', { timeout: 20_000 }, () => {
  it('has the pending choices as its open entries, in the same order', () => {
    const dir = join(root, 'examples', 'characters');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
      const character = parse(readFileSync(join(dir, file), 'utf8')) as CharacterDoc;
      const sheet = computeSheet(ruleset, character);
      expect(sheet.choices.length, file).toBeGreaterThan(0);
      expect(
        sheet.choices
          .filter((c) => c.open)
          .map(({ path, min, max, picks, slot }) => ({
            path,
            min,
            ...(max === undefined ? {} : { max }),
            picked: picks.length,
            ...(slot ? { slot } : {}),
          })),
        file,
      ).toEqual(sheet.pending);
    }
  });

  it('keeps its order when an answer is swapped, and lists the new answer’s choices', () => {
    const marine: CharacterDoc = {
      specVersion: '0.1.0',
      id: 'test',
      packs: [{ id: 'mothership-1e', version: '0.2.0' }],
      features: [{ id: 'class', item: 'mothership-1e:classes.marine' }],
    };
    const keys = (c: CharacterDoc) =>
      computeSheet(mothership.ruleset, c).choices.map((x) => [x.path.choice.join(' > '), x.open]);
    expect(keys(marine)).toEqual([['bonus-skills', true]]);
    const path = { entry: 'class', choice: ['bonus-skills'] };
    const expert = applyChanges(mothership.ruleset, marine, [
      { type: 'choose', path, option: 'expert' },
    ]);
    if (!expert.ok) throw new Error(JSON.stringify(expert.errors));
    expect(keys(expert.character)).toEqual([
      ['bonus-skills', false],
      ['bonus-skills > expert > expert', true],
    ]);
    const trained = applyChanges(mothership.ruleset, expert.character, [
      { type: 'unchoose', path },
      { type: 'choose', path, option: 'trained' },
    ]);
    if (!trained.ok) throw new Error(JSON.stringify(trained.errors));
    expect(keys(trained.character)).toEqual([
      ['bonus-skills', false],
      ['bonus-skills > trained > trained', true],
    ]);
  });

  it('is empty when the homebrew does not load', () => {
    const pack = {
      manifest: {
        id: 'test-pack',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: {},
      content: [],
    } as unknown as PackRelease;
    const one = loadRuleset([pack]);
    if (!one.ok) throw new Error(JSON.stringify(one.errors));
    const sheet = computeSheet(one.ruleset, {
      specVersion: '0.1.0',
      id: 'test',
      packs: [{ id: 'test-pack', version: '1.0.0' }],
      homebrew: { content: [{ id: 'x', type: 'missing' }] },
    } as unknown as CharacterDoc);
    expect(sheet.errors.map((e) => e.code)).toEqual(['homebrew-error']);
    expect(sheet.choices).toEqual([]);
  });
});
