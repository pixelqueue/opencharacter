import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  computeSheet,
  continueAction,
  diceFrom,
  startAction,
  type CharacterDoc,
} from '@opencharacter/engine';
import { createText, describeNeed, keys } from '../src/index.ts';
import { load, root } from './packs.ts';

const paused = (result: ReturnType<typeof startAction>) => {
  if (!('status' in result) || result.status !== 'paused')
    throw new Error(JSON.stringify(result).slice(0, 400));
  return result;
};

describe('Mothership', () => {
  const { ruleset, text } = load('mothership/1e');
  const marine: CharacterDoc = {
    specVersion: '0.1.0',
    id: 'marine',
    packs: [{ id: 'mothership-1e', version: '0.1.1' }],
    values: { 'mothership-1e:stats.strength': 34 },
    features: [
      {
        id: 'class',
        item: 'mothership-1e:classes.marine',
        choices: { 'bonus-skills': [{ option: 'trained' }] },
      },
    ],
  };

  it("words a nested choice's prompt from its owner, not its path", () => {
    const sheet = computeSheet(ruleset, marine);
    const trained = sheet.choices.find((c) => c.id === 'trained');
    expect(trained?.owner).toBe(
      'mothership-1e:classes.marine.choices.bonus-skills.options.trained',
    );
    expect(text.choicePrompt(trained!)).toBe('Choose two Trained skills');
    const bonus = sheet.choices.find((c) => c.id === 'bonus-skills')!;
    expect(text.choicePrompt(bonus)).toBe('Choose one Expert skill or two Trained skills');
    expect(text.option(bonus.picks[0]!, { choice: bonus })).toBe('Two Trained skills');
    expect(text.option('mothership-1e:skills.zero-g')).toBe('Zero-G');
  });

  it("words a stat check's dice and what it is rolled against", () => {
    const need = paused(
      startAction(ruleset, marine, {
        action: { id: 'mothership-1e:stat-check' },
        params: { stat: 'mothership-1e:stats.strength' },
        situational: { 'mothership-1e:advantage': true },
        policy: { dice: 'pause' },
      }),
    ).needs;
    const worded = describeNeed(ruleset, text, need);
    expect(worded.title).toBe('Stat check');
    expect(worded.dice).toBe('2d100, keep lowest');
    expect(worded.targets?.find((t) => t.band === 'success')).toEqual({
      band: 'success',
      name: 'Success',
      condition: 'Roll under 34 (90+ always fails)',
    });
  });
});

describe('5E', () => {
  const { ruleset, text } = load('5e/srd-5.1');

  it("names a tag, and a set field's members", () => {
    expect(text.tag('5e-srd-5.1:save.int')).toBe('Intelligence saving throw');
    expect(text.tag('save.int', '5e-srd-5.1')).toBe('Intelligence saving throw');
    expect(text.tag('5e-srd-5.1:skill.sleight-of-hand')).toBe('Sleight of Hand');
    expect(text.tag('5e-srd-5.1:save')).toBe('Saving throw');
    expect(text.tag('5e-srd-5.1:no.such')).toBe('5e-srd-5.1:no.such');
    expect(text.tag('save.int')).toBe('save.int');
    // Content, else a field, else a tag, else the ID.
    expect(text.setMember('5e-srd-5.1:armor.shield')).toBe('Shield');
    expect(text.setMember('combat.ac', '5e-srd-5.1')).toBe('Armor Class');
    expect(text.setMember('skill.arcana', '5e-srd-5.1')).toBe('Arcana');
    expect(text.setMember('save.wis', '5e-srd-5.1')).toBe('Wisdom saving throw');
    expect(text.setMember('nothing', '5e-srd-5.1')).toBe('nothing');
  });

  it('names a value option without its own text by its tag or field (B10)', () => {
    const skills = { owner: '5e-srd-5.1:classes.fighter', id: 'skills' };
    expect(text.option('skill.arcana', { choice: skills })).toBe('Arcana');
    expect(text.option('save.wis', { choice: skills })).toBe('Wisdom saving throw');
    expect(text.option('nothing.here', { choice: skills })).toBe('nothing.here');
    // A written option without text falls back the same way, in the action's pack.
    expect(text.option('skill.stealth', { action: '5e-srd-5.1:skill-check' })).toBe('Stealth');
    expect(text.option('#done', { choice: skills })).toBe('Skip the rest');
    expect(text.option('#done')).toBe('Done');
  });

  it("names a rules field's and a parameter's enum values", () => {
    expect(text.fieldValue('5e-srd-5.1:creature.size', 'medium')).toBe('Medium');
    expect(text.fieldValue('5e-srd-5.1:creature.size', 'colossal')).toBe('colossal');
    expect(text.paramValue('5e-srd-5.1:cast-spell', 'slotType', 'pact')).toBe('Pact slot');
    expect(
      text.paramValue('5e-srd-5.1:features.fighter.indomitable#indomitable', 'ability', 'wis'),
    ).toBe('Wisdom');
    expect(keys.paramValueKey('5e-srd-5.1:cast-spell', 'slotType', 'pact')).toEqual({
      pack: '5e-srd-5.1',
      key: 'actions.cast-spell.params.slotType.values.pact.name',
    });
  });

  it('names item fields, template fields and parameters, with their hints', () => {
    expect(text.typeField('5e-srd-5.1:weapon', 'damageType')).toBe('Damage type');
    expect(text.typeField('5e-srd-5.1:armor', 'maxDex')).toBe('Dexterity cap');
    expect(text.typeFieldDescription('5e-srd-5.1:armor', 'maxDex')).toBe(
      'The most Dexterity modifier AC adds.',
    );
    expect(text.typeFieldDescription('5e-srd-5.1:weapon', 'damage')).toBeUndefined();
    expect(text.typeField('5e-srd-5.1:weapon', 'nothing')).toBe('nothing');
    expect(text.templateField('5e-srd-5.1:acBonus')).toBe('AC bonus');
    expect(text.templateFieldDescription('5e-srd-5.1:acBonus')).toBe('Added to AC while worn.');
    expect(text.templateField('5e-srd-5.1:nothing')).toBe('nothing');
    expect(text.param('5e-srd-5.1:skill-check', 'dc')).toBe('DC');
    expect(text.paramDescription('5e-srd-5.1:skill-check', 'dc')).toMatch(/Difficulty Class/);
    expect(text.paramDescription('5e-srd-5.1:skill-check', 'skill')).toBeUndefined();
    expect(text.param('5e-srd-5.1:skill-check', 'nothing')).toBe('nothing');
    expect(keys.typeFieldKey('5e-srd-5.1:weapon', 'damage', 'description')).toEqual({
      pack: '5e-srd-5.1',
      key: 'types.weapon.fields.damage.description',
    });
    expect(keys.templateFieldKey('5e-srd-5.1:acBonus')).toEqual({
      pack: '5e-srd-5.1',
      key: 'templateFields.acBonus.name',
    });
    expect(
      keys.paramKey('mork-borg-core:classes.fanged-deserter#bite', 'dr', 'description'),
    ).toEqual({
      pack: 'mork-borg-core',
      key: 'classes.fanged-deserter.actions.bite.params.dr.description',
    });
  });

  it("words a slotted choice's prompt with its slot", () => {
    const owner = '5e-srd-5.1:features.wizard.spellcasting';
    expect(
      text.choicePrompt({ owner, id: 'spellbook-1', slot: { choice: 'spellbook', number: 1 } }),
    ).toBe('Choose six 1st-level spells for your spellbook');
    expect(
      text.choicePrompt({ owner, id: 'spellbook-3', slot: { choice: 'spellbook', number: 3 } }),
    ).toBe('Choose two spells for your spellbook (level 3)');
  });

  it("words a slotted choice from a wizard's choice list", () => {
    const wizard: CharacterDoc = {
      specVersion: '0.1.0',
      id: 'wizard',
      packs: [{ id: '5e-srd-5.1', version: '0.2.0' }],
      inventory: [],
      features: [{ id: 'class', item: '5e-srd-5.1:classes.wizard', state: { level: 2 } }],
    };
    const prompts = computeSheet(ruleset, wizard)
      .choices.filter((c) => c.slot?.choice === 'spellbook')
      .map((c) => text.choicePrompt(c));
    expect(prompts).toEqual([
      'Choose six 1st-level spells for your spellbook',
      'Choose two spells for your spellbook (level 2)',
    ]);
  });

  it('words too many copies by the type’s own text', () => {
    const twoRaces: CharacterDoc = {
      specVersion: '0.1.0',
      id: 'two-races',
      packs: [{ id: '5e-srd-5.1', version: '0.2.0' }],
      features: [
        { id: 'race1', item: '5e-srd-5.1:races.elf' },
        { id: 'race2', item: '5e-srd-5.1:races.dwarf' },
      ],
    };
    const issue = computeSheet(ruleset, twoRaces).issues.find((i) => i.code === 'too-many-copies');
    expect(issue).toBeDefined();
    expect(text.issue(issue!)).toBe('A character has only one race');
    const bare = createText({
      languages: ['en'],
      packs: {},
      spec: { en: { 'issues.too-many-copies': 'At most {limit}.' } },
    });
    expect(bare.issue(issue!)).toBe('At most 1.');
  });

  it('words a constraint and an error, ids named', () => {
    expect(
      text.issue({
        code: 'constraint-failed',
        id: '5e-srd-5.1:attunement-limit',
        data: { limit: 3, attuned: 4 },
      }),
    ).toMatch(/at most 3 magic items/);
    expect(
      text.error({
        code: 'not-input-field',
        data: { field: '5e-srd-5.1:combat.ac' },
      }),
    ).toBe('"Armor Class" is calculated and cannot be set directly.');
  });

  it('words 4d6 dropping the lowest', () => {
    const blank: CharacterDoc = {
      specVersion: '0.1.0',
      id: 'new',
      packs: [{ id: '5e-srd-5.1', version: '0.2.0' }],
      creating: true,
    };
    let result = paused(
      startAction(
        ruleset,
        blank,
        {
          action: { id: '5e-srd-5.1:create-character' },
          answers: [
            { option: '5e-srd-5.1:races.dwarf' },
            { option: '5e-srd-5.1:subraces.hill-dwarf' },
            { option: '5e-srd-5.1:classes.barbarian' },
            { option: '5e-srd-5.1:backgrounds.acolyte' },
          ],
          // oxlint-disable-next-line unicorn/no-thenable
          policy: { rules: [{ kind: 'choice', step: 'method', then: 'pause' }], dice: 'pause' },
        },
        diceFrom([]),
      ),
    );
    expect(result.needs.step).toBe('method');
    const method = describeNeed(ruleset, text, result.needs);
    expect(method.options.map((o) => o.id)).toContain('roll');
    result = paused(continueAction(ruleset, result, { option: 'roll' }, { dice: 'pause' }));
    const roll = describeNeed(ruleset, text, result.needs);
    expect(roll.dice).toBe('4d6, drop lowest');
    expect(roll.targets).toBeUndefined();
  });
});

describe('Forged in the Dark', () => {
  const { ruleset, text } = load('fitd/scoundrel');

  it('names a situational choice and its values', () => {
    expect(text.situational('fitd-scoundrel:position')).toBe('Position');
    expect(text.situationalValue('fitd-scoundrel:bonusDie', 'devils-bargain')).toBe(
      "Take a devil's bargain (+1d)",
    );
    expect(text.situationalValue('fitd-scoundrel:bonusDie', 'other')).toBe('other');
    // An item's key its type declares falls back to the type's names.
    expect(
      text.stateValue(
        'fitd-scoundrel:designs.arcane',
        'kind',
        'spark-craft',
        'fitd-scoundrel:design',
      ),
    ).toBe('Spark-craft');
  });

  it("words a random draw by its step's prompt and what the die picks among", () => {
    const scoundrel: CharacterDoc = {
      specVersion: '0.1.0',
      id: 'new',
      packs: [{ id: 'fitd-scoundrel', version: '0.2.0' }],
      creating: true,
    };
    const need = paused(
      startAction(ruleset, scoundrel, {
        action: { id: 'fitd-scoundrel:create-scoundrel' },
        params: { random: true },
        policy: { dice: 'pause' },
      }),
    ).needs;
    // No playbook (the pack has none): the first draw is a special ability from the SRD's pool.
    expect(need.draw?.among).toHaveLength(42);
    const worded = describeNeed(ruleset, text, need);
    expect(worded.draw).toBe(true);
    expect(worded.title).toBe('Choose a special ability');
    expect(worded.dice).toBe('1d42');
    expect(worded.options[0]).toEqual({
      id: 'fitd-scoundrel:special-abilities.a-little-something-on-the-side',
      label: 'A Little Something on the Side',
    });
  });

  it('words written and added options of a choice step', () => {
    const cutter: CharacterDoc = {
      specVersion: '0.1.0',
      id: 'kit',
      packs: [{ id: 'fitd-scoundrel', version: '0.2.0' }],
      values: {
        'fitd-scoundrel:stress.current': 3,
        'fitd-scoundrel:ratings.skirmish': 2,
      },
      choices: {
        'special-abilities': [{ option: 'fitd-scoundrel:special-abilities.battleborn' }],
      },
    };
    const result = paused(
      startAction(
        ruleset,
        cutter,
        {
          action: { id: 'fitd-scoundrel:action-roll' },
          params: { rating: 'fitd-scoundrel:ratings.skirmish' },
          situational: { 'fitd-scoundrel:bonusDie': 'push' },
          // oxlint-disable-next-line unicorn/no-thenable
          policy: { rules: [{ kind: 'choice', tags: ['push-cost'], then: 'pause' }] },
        },
        diceFrom([2, 4, 6]),
      ),
    );
    expect(describeNeed(ruleset, text, result.needs)).toEqual({
      title: 'How do you pay for pushing yourself?',
      options: [
        { id: 'stress', label: 'Take 2 stress per push' },
        {
          id: 'fitd-scoundrel:special-abilities.battleborn#special-armor',
          label: 'Mark special armor instead of stress (Battleborn: pushing while fighting)',
        },
      ],
      fields: [],
    });
  });

  it('words a pick over pending choices by the choice asked', () => {
    expect(text.choicePrompt({ owner: 'fitd-scoundrel:rules', id: 'trauma' })).toBe(
      'Choose a trauma condition for each trauma',
    );
    expect(text.option('#done')).toBe('Done');
  });
});

describe('Fate', () => {
  const { ruleset, text } = load('fate/core');

  it('words Fate dice and the ladder', () => {
    const mara = parse(
      readFileSync(join(root, 'examples', 'characters', 'fate-mara.yaml'), 'utf8'),
    ) as CharacterDoc;
    const need = paused(
      startAction(ruleset, mara, {
        action: { id: 'fate-core:skill-roll' },
        params: { action: 'overcome' },
        policy: { dice: 'pause' },
      }),
    ).needs;
    const worded = describeNeed(ruleset, text, need);
    expect(worded.title).toBe('Roll'); // actions.skill-roll.steps.roll.name
    expect(worded.dice).toBe('4dF');
    expect(worded.targets?.slice(0, 2)).toEqual([
      { band: 'legendary', name: 'Legendary (+8)', condition: '8 or higher' },
      { band: 'epic', name: 'Epic (+7)', condition: 'exactly 7' },
    ]);
    // A band that holds whatever the roll: no tests, no text.
    expect(worded.targets?.at(-1)).toEqual({ band: 'terrible', name: 'Terrible (−2)' });
  });

  it("names an item's own state values", () => {
    expect(text.stateValue('fate-core:stunts.custom', 'limit', 'scene')).toBe('scene');
    expect(text.stateValue('fate-core:stunts.custom', 'action', 'advantage')).toBe(
      'Create an advantage',
    );
    expect(text.stateValue('fate-core:stunts.custom', 'action', 'unknown')).toBe('unknown');
    expect(keys.stateValueKey('fate-core:stunts.custom', 'limit', 'scene')).toEqual({
      pack: 'fate-core',
      key: 'stunts.custom.state.limit.values.scene.name',
    });
  });
});

describe('orc-2e', () => {
  const { ruleset, text } = load('orc/2e');

  it('names a Lore the player names', () => {
    const sheet = computeSheet(ruleset, {
      specVersion: '0.1.0',
      id: 'urchin',
      packs: [{ id: 'orc-2e', version: '0.2.0' }],
      values: { 'orc-2e:skills.lore.custom1.subject': 'Absalom' },
      features: [{ id: 'background', item: 'orc-2e:backgrounds.street-urchin' }],
    });
    const id = 'orc-2e:skills.lore.custom1.mod';
    expect(text.field(id, { name: sheet.values[id]?.name })).toBe('Absalom Lore');
    expect(text.field('orc-2e:skills.lore.custom2.mod')).toBe('Lore');
  });

  it("names an option a content type adds by the type's text", () => {
    expect(text.option('orc-2e:staves.staff-of-healing#rank1')).toBe('1 charge from the staff');
    expect(text.option('orc-2e:wands.magic-wand-1st-rank-spell#cast')).toBe(
      "The wand's daily casting",
    );
  });
});

describe('keys and fallbacks', () => {
  const { text, spec } = load('mothership/1e');

  it('builds step keys from the defining action and the last path segment', () => {
    expect(keys.stepKey({ action: 'mothership-1e:panic-check', step: 'panic/panic' })).toEqual({
      pack: 'mothership-1e',
      key: 'actions.panic-check.steps.panic.prompt',
    });
    expect(keys.stepId('saves[1]')).toBe('saves');
    expect(keys.tagKey('p:save.int')).toEqual({ pack: 'p', key: 'tags.save.int.name' });
    expect(keys.tagKey('save.int', 'p')).toEqual({ pack: 'p', key: 'tags.save.int.name' });
    expect(keys.actionRoot('p:features.x#go')).toEqual({ pack: 'p', key: 'features.x.actions.go' });
    expect(keys.addedOptionKey('p:items.a#b')).toEqual({
      pack: 'p',
      key: 'items.a.options.b.name',
    });
  });

  it('falls back to any language the bundle holds', () => {
    const de = createText({
      languages: ['de'],
      packs: {
        de: { 'mothership-1e': { 'classes.marine.name': 'Marinesoldat' } },
        en: { 'mothership-1e': { 'classes.android.name': 'Android' } },
      },
      spec: { en: spec },
    });
    expect(de.content('mothership-1e:classes.marine')).toBe('Marinesoldat');
    expect(de.content('mothership-1e:classes.android')).toBe('Android');
    expect(de.content('mothership-1e:classes.nobody')).toBe('mothership-1e:classes.nobody');
    expect(de.option('#done')).toBe('Done');
  });

  it('words dice modifiers and joins items', () => {
    expect(
      text.dice([
        { kind: 'dice', count: 2, sides: 20, modifiers: [{ type: 'keepHighest', count: 1 }] },
        { kind: 'flat', count: undefined, sides: undefined },
        { kind: 'dice', count: 1, sides: 4, sign: -1 },
      ] as never),
    ).toBe('2d20, keep highest - 1d4');
    expect(
      text.dice([
        {
          count: 5,
          sides: 6,
          modifiers: [
            { type: 'explode' },
            { type: 'reroll', compare: '<=', target: 2 },
            { type: 'dropLowest', count: 2 },
          ],
        },
      ]),
    ).toBe('5d6, exploding on 6, reroll 2 or lower, drop lowest 2');
  });

  it('words a roll made more than once', () => {
    const dice = [{ kind: 'dice', count: 2, sides: 6 }] as never;
    expect(text.dice(dice, { times: 2, keep: 'low' })).toBe(
      '2d6, rolled twice, keep the lower total',
    );
    expect(text.dice(dice, { times: 3, keep: 'high' })).toBe(
      '2d6, rolled 3 times, keep the highest total',
    );
  });

  it('leaves out a keep or drop that cannot change the roll', () => {
    // A FitD pool of one die: keeping the highest of one is the die.
    expect(
      text.dice([{ count: 1, sides: 6, modifiers: [{ type: 'keepHighest', count: 1 }] }]),
    ).toBe('1d6');
    expect(text.dice([{ count: 2, sides: 6, modifiers: [{ type: 'keepLowest', count: 2 }] }])).toBe(
      '2d6',
    );
    expect(text.dice([{ count: 3, sides: 6, modifiers: [{ type: 'dropLowest', count: 0 }] }])).toBe(
      '3d6',
    );
    // Zero dice rolls two and keeps the lowest: that keep counts.
    expect(text.dice([{ count: 2, sides: 6, modifiers: [{ type: 'keepLowest', count: 1 }] }])).toBe(
      '2d6, keep lowest',
    );
    // Explosions add dice, so a keep counts even on one die.
    expect(
      text.dice([
        {
          count: 1,
          sides: 6,
          modifiers: [{ type: 'explode' }, { type: 'keepHighest', count: 1 }],
        },
      ]),
    ).toBe('1d6, exploding on 6, keep highest');
  });

  it('words a roll summary by the spec’s comparisons without pack text', () => {
    expect(
      text.rollTargets({
        bandSet: 'mothership-1e:nothing',
        bands: [
          {
            band: 'hit',
            when: 'roll.total >= 10 && roll.total < 20',
            tests: [
              { of: 'roll.total', compare: 'ge', value: 10 },
              { of: 'roll.total', compare: 'lt', value: 20 },
            ],
          },
        ],
        flags: {},
      }),
    ).toEqual([{ band: 'hit', name: 'hit', condition: '10 or higher and under 20' }]);
  });

  it('falls back to the choice ID for a missing prompt, and words no condition for a band that compares nothing', () => {
    expect(text.choicePrompt({ owner: 'mothership-1e:rules', id: 'no-such-choice' })).toBe(
      'no-such-choice',
    );
    expect(
      text.rollTargets({
        bandSet: 'mothership-1e:check',
        bands: [{ band: 'success', when: 'true', tests: [] }],
        flags: {},
      }),
    ).toEqual([{ band: 'success', name: text.band('mothership-1e:check', 'success') }]);
  });
});

describe('FitD standard copies', () => {
  const { ruleset, text } = load('fitd/scoundrel');

  it('names a standard copy the file has not saved by its item', () => {
    // Alchemist's starting formula is a standard copy (crafting.yaml); a file that changed
    // nothing saves none, so a step over the copies offers instance IDs the file doesn't list.
    const worded = describeNeed(
      ruleset,
      text,
      {
        kind: 'choice',
        action: 'fitd-scoundrel:craft-design',
        step: 'design',
        options: ['fitd-scoundrel-designs-alchemical'],
      } as never,
      { character: { specVersion: '0.1.0', id: 'kit', packs: [] } as never },
    );
    expect(worded.options).toEqual([
      { id: 'fitd-scoundrel-designs-alchemical', label: 'Alchemical formula' },
    ]);
  });
});

describe('codes never reach players bare', () => {
  const { ruleset, text } = load('fitd/scoundrel');

  it('words a removed item, passed as an error or as an issue, and a code without text', () => {
    const sheet = computeSheet(ruleset, {
      specVersion: '0.1.0',
      id: 'old',
      packs: [{ id: 'fitd-scoundrel', version: '0.2.0' }],
      features: [{ id: 'gone', item: 'fitd-scoundrel:removed.thing' }],
    });
    const error = sheet.errors.find((e) => e.code === 'unknown-id');
    expect(error).toBeDefined();
    const worded = text.error(error!);
    expect(worded).toContain('no longer has');
    expect(text.issue(error as never)).toBe(worded);
    expect(text.issue({ code: 'not-a-code', data: {} } as never)).toBe(
      'Something went wrong (not-a-code).',
    );
  });

  it('falls back to errors.other when the data misses an argument', () => {
    expect(text.error({ code: 'not-owned', data: {} })).toBe('Something went wrong (not-owned).');
  });
});

describe('error text by its data', () => {
  const { text } = load('mork-borg/core');
  const target = 'mork-borg-core:hp.max';

  it('words a range with one bound or both', () => {
    expect(text.error({ code: 'out-of-range', data: { target, min: 1 } })).toBe(
      '"Maximum HP" must be at least 1.',
    );
    expect(text.error({ code: 'out-of-range', data: { target, max: 5 } })).toBe(
      '"Maximum HP" must be at most 5.',
    );
    expect(text.error({ code: 'out-of-range', data: { target, min: 1, max: 5 } })).toBe(
      '"Maximum HP" must be between 1 and 5.',
    );
  });

  it('words each safety limit', () => {
    expect(text.error({ code: 'safety-limit-exceeded', data: { limit: 'maxOverflowChain' } })).toBe(
      'Too many overflows from one change.',
    );
    expect(text.error({ code: 'safety-limit-exceeded', data: { limit: 'maxNew' } })).toBe(
      'A safety limit was reached (maxNew).',
    );
  });

  it('words a family key that is not there', () => {
    const awn = load('awn/core');
    const hollis = parse(
      readFileSync(join(root, 'examples', 'characters', 'awn-core-hollis.yaml'), 'utf8'),
    ) as CharacterDoc;
    const result = startAction(awn.ruleset, hollis, {
      action: { id: 'awn-core:gain-benefit' },
      params: { entry: 'x' },
    });
    const error = 'errors' in result ? result.errors?.[0] : undefined;
    expect(error?.data).toMatchObject({ key: 'x', family: 'skill' });
    expect(awn.text.error(error!)).toBe('A formula refers to "x", which is not there.');
  });
});

describe('FitD crew factions', () => {
  const { ruleset, text } = load('fitd/crew');
  const faction = 'fitd-crew:factions.faction';

  it("names a faction copy by the GM's label", () => {
    // Seize a claim's "the faction it was taken from" offers faction copies: each by its label.
    const worded = describeNeed(
      ruleset,
      text,
      {
        kind: 'choice',
        action: 'fitd-crew:seize-claim',
        step: 'from',
        options: ['sashes', 'lampblacks', 'unnamed'],
      } as never,
      {
        character: {
          specVersion: '0.1.0',
          id: 'ravens',
          packs: [],
          features: [
            { id: 'sashes', item: faction, state: { label: 'The Red Sashes' } },
            { id: 'lampblacks', item: faction, state: { label: 'The Lampblacks' } },
            { id: 'unnamed', item: faction },
          ],
        } as never,
      },
    );
    expect(worded.options.map((o) => o.label)).toEqual([
      'The Red Sashes',
      'The Lampblacks',
      text.content(faction),
    ]);
    expect(text.copy({ item: faction, name: ' ' })).toBe(text.content(faction));
  });
});
