import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { computeSheet } from '@opencharacter/engine';
import type { CharacterFile as CharacterDoc } from '@opencharacter/spec';
import { createText, headlineArgument, type HeadlineSheet } from '../src/index.ts';
import { load, root } from './packs.ts';

const example = (name: string) =>
  parse(readFileSync(join(root, 'examples', 'characters', `${name}.yaml`), 'utf8')) as CharacterDoc;

const character = (pack: string, rest: Partial<CharacterDoc> = {}): CharacterDoc => ({
  specVersion: '0.1.0',
  id: 'c',
  packs: [{ id: pack, version: '0.1.0' }],
  ...rest,
});

function headlines(...dirs: string[]) {
  const { ruleset, text } = load(...dirs);
  return (doc: CharacterDoc, links?: Record<string, string>) => {
    const sheet = computeSheet(ruleset, doc) as unknown as HeadlineSheet;
    return text.headline(sheet, doc, links ? { links } : {});
  };
}

describe('arguments', () => {
  const scope = {
    field: (s: string) => ['level_total', 'tier', 'aspects_name'].includes(s),
    type: (n: string) => ['class', 'race'].includes(n),
    link: (n: string) => n === 'crew',
  };
  it('reads fields, types, links and has_', () => {
    expect(headlineArgument('field_level_total', scope)).toEqual({
      kind: 'field',
      spelled: 'level_total',
      as: 'value',
    });
    expect(headlineArgument('field_tier_text', scope)).toMatchObject({ as: 'text' });
    expect(headlineArgument('field_tier_name', scope)).toMatchObject({ as: 'name' });
    // A field whose spelling ends in `_name` is the field.
    expect(headlineArgument('field_aspects_name', scope)).toMatchObject({
      spelled: 'aspects_name',
      as: 'value',
    });
    expect(headlineArgument('type_class_each', scope)).toEqual({
      kind: 'type',
      type: 'class',
      as: 'each',
    });
    expect(headlineArgument('type_race_count', scope)).toMatchObject({ as: 'count' });
    expect(headlineArgument('has_link_crew', scope)).toEqual({
      kind: 'has',
      of: { kind: 'link', slot: 'crew' },
    });
    expect(headlineArgument('field_nope', scope)).toBeUndefined();
    expect(headlineArgument('type_class_level', scope)).toBeUndefined();
    expect(headlineArgument('has_has_type_class', scope)).toBeUndefined();
    expect(headlineArgument('level', scope)).toBeUndefined();
  });
});

describe('a synthetic pack', () => {
  const text = createText({
    languages: ['en'],
    spec: { en: {} },
    packs: {
      en: {
        p: {
          headline: '{field_score_text} · {type_thing_each} · {field_note}',
          'headline.separator': ' + ',
          'types.thing.headline': '{name} ({self_size})',
          'things.lamp.name': 'Lamp',
          'things.rock.name': 'Rock',
          'things.rock.headline': 'a rock',
          'units.ft.short': 'ft',
        },
        q: { headline: 'never: an earlier pack' },
      },
    },
    contentTypes: { 'p:thing': {} },
    content: { 'p:things.lamp': { type: 'p:thing' }, 'p:things.rock': { type: 'p:thing' } },
    display: { fields: { 'p:score': { format: 'fraction', unit: 'ft', pack: 'p' } } },
  });
  const sheet: HeadlineSheet = {
    values: { 'p:score': { value: 2.5 }, 'p:note': { value: '  spaced   out ' } },
    activations: [
      { item: 'p:things.lamp', entry: 'l', via: 'copy' },
      { item: 'p:things.rock', entry: 'r', via: 'copy' },
    ],
  };
  const doc = {
    packs: [{ id: 'q' }, { id: 'p' }],
    features: [{ id: 'l', item: 'p:things.lamp', state: { size: 2 } }],
  };
  it("takes the last pack's headline, joins lists by its separator and collapses spaces", () => {
    expect(text.headline(sheet, doc)).toBe('2 1/2 ft · Lamp (2) + a rock · spaced out');
  });
  it('is undefined without a headline, or with nothing to word', () => {
    expect(text.headline(sheet, { packs: [{ id: 'r' }] })).toBeUndefined();
    const blank = createText({
      languages: ['en'],
      spec: { en: {} },
      packs: { en: { p: { headline: '{field_note}' } } },
    });
    expect(blank.headline({ values: { 'p:note': { value: '' } } })).toBeUndefined();
  });
});

describe('5E', () => {
  const headline = headlines('5e/srd-5.1');
  const dwarf = {
    id: 'race',
    item: '5e-srd-5.1:races.dwarf',
    choices: { subrace: [{ option: '5e-srd-5.1:subraces.hill-dwarf' }] },
  };
  const pack = '5e-srd-5.1';
  it('words a finished character', () => {
    const doc = character(pack, {
      features: [
        dwarf,
        {
          id: 'wizard',
          item: '5e-srd-5.1:classes.wizard',
          state: { level: 3, startingClass: true },
        },
      ],
    });
    expect(headline(doc)).toBe('Level 3 Hill dwarf Wizard');
  });
  it('words each class with its level when multiclassed', () => {
    const doc = character(pack, {
      features: [
        dwarf,
        {
          id: 'wizard',
          item: '5e-srd-5.1:classes.wizard',
          state: { level: 2, startingClass: true },
        },
        { id: 'fighter', item: '5e-srd-5.1:classes.fighter', state: { level: 1 } },
      ],
    });
    expect(headline(doc)).toBe('Hill dwarf Wizard 2 / Fighter 1');
    expect(headline(example('5e-tamsin'))).toBe('Fighter 3 / Barbarian 1');
  });
  it('words a partial character while it is created', () => {
    expect(headline(character(pack, { creating: true }))).toBeUndefined();
    const race = { id: 'race', item: '5e-srd-5.1:races.dwarf' };
    expect(headline(character(pack, { creating: true, features: [race] }))).toBe('Dwarf');
    expect(headline(character(pack, { creating: true, features: [dwarf] }))).toBe('Hill dwarf');
  });
  it('words a monster', () => {
    expect(headline(example('5e-goblin'))).toBe('Goblin, CR 1/4');
    const aboleth = character(pack, {
      values: { '5e-srd-5.1:challenge.rating': 10 },
      features: [{ id: 'monster', item: '5e-srd-5.1:monsters.aboleth' }],
    });
    expect(headline(aboleth)).toBe('Aboleth, CR 10');
  });
});

describe('orc-2e', () => {
  const headline = headlines('orc/2e');
  const pack = 'orc-2e';
  const elf = { id: 'ancestry', item: 'orc-2e:ancestries.elf' };
  it('words a finished character', () => {
    const doc = character(pack, {
      values: { 'orc-2e:level': 2 },
      features: [elf, { id: 'class', item: 'orc-2e:classes.rogue' }],
    });
    expect(headline(doc)).toBe('Level 2 Elf Rogue');
  });
  it('words a partial character', () => {
    expect(headline(character(pack, { creating: true }))).toBeUndefined();
    expect(headline(character(pack, { creating: true, features: [elf] }))).toBe('Elf');
  });
});

describe('Forged in the Dark', () => {
  const headline = headlines('fitd/scoundrel', 'fitd/crew');
  it('words nothing for a scoundrel without a playbook', () => {
    // The pack names no playbooks (the SRD has none); a table's own is homebrew.
    expect(headline(example('fitd-vex'))).toBeUndefined();
    expect(headline(example('fitd-vex'), { 'fitd-scoundrel:crew': 'the Ravens' })).toBeUndefined();
  });
  it('words a crew by its tier, the SRD naming no crew types', () => {
    expect(headline(example('fitd-crew-ravens'))).toBe('Tier 1');
    expect(headline(character('fitd-crew', { creating: true }))).toBe('Tier 0');
  });
  it('words nothing before a playbook', () => {
    expect(headline(character('fitd-scoundrel', { creating: true }))).toBeUndefined();
  });
});

describe('Mothership', () => {
  const headline = headlines('mothership/1e');
  it('words the class', () => {
    expect(headline(example('mothership-reyes'))).toBe('Marine');
    expect(headline(character('mothership-1e', { creating: true }))).toBeUndefined();
  });
});

describe('Fate Core', () => {
  const headline = headlines('fate/core');
  it('words the high concept', () => {
    expect(headline(example('fate-mara'))).toBe('Disgraced Duelist of the Seven Courts');
    expect(headline(character('fate-core', { creating: true }))).toBeUndefined();
  });
});

describe('MÖRK BORG', () => {
  const headline = headlines('mork-borg/core');
  const pack = 'mork-borg-core';
  it('words the class, a classless character and a companion', () => {
    expect(headline(example('mork-borg-agnes'))).toBe('Heretical Priest');
    const classless = character(pack, {
      features: [{ id: 'class', item: 'mork-borg-core:classes.classless' }],
    });
    expect(headline(classless)).toBe('Classless');
    expect(headline(example('mork-borg-grub-hound'))).toBe('Ancient Gore-Hound');
    expect(headline(character(pack, { creating: true }))).toBeUndefined();
  });
});
