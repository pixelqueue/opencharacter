import { describe, expect, it } from 'vitest';
import {
  blockArgument,
  createText,
  messageArguments,
  type BlockCopy,
  type BlockItem,
} from '../src/index.ts';
import { load } from './packs.ts';

const isField = (n: string) => ['level', 'has_x'].includes(n);

const item = (ruleset: { content: Record<string, unknown> }, id: string) =>
  ruleset.content[id] as BlockItem;

describe('a synthetic pack', () => {
  const text = createText({
    languages: ['en'],
    spec: { en: {} },
    packs: {
      en: {
        p: {
          'things.lamp.name': 'Lamp',
          'things.lamp.description': 'It glows.',
          'things.lamp.texts.fuel': 'oil',
          'things.rock.name': 'Rock',
          'things.odd.name': 'Odd',
          'things.odd.block': '{name}: {nope',
          'tags.heavy.name': 'Heavy',
          'types.thing.block':
            '**{name}** · {kind_name} · {tags_name}{has_size, select, true { · {size} ft} other {}}{has_texts_fuel, select, true { · burns {texts_fuel}} other {}}{self_lit, select, true { · lit} other {}}{has_self_glow, select, true { · {self_glow, plural, one {# glow} other {# glows}}} other {}}',
          'types.thing.fields.kind.values.light.name': 'Light source',
        },
      },
    },
  });
  const lamp = { id: 'p:things.lamp', type: 'p:thing', fields: { kind: 'light' }, tags: ['heavy'] };

  it('fills a block from fields, tags, texts and a copy', () => {
    expect(text.contentBlock(lamp)).toBe('**Lamp** · Light source · Heavy · burns oil');
    expect(
      text.contentBlock(
        { ...lamp, fields: { kind: 'light', size: 5 } },
        {
          state: { lit: true },
          computed: { glow: 3 },
        },
      ),
    ).toBe('**Lamp** · Light source · Heavy · 5 ft · burns oil · lit · 3 glows');
    expect(
      text.contentBlock(
        { id: 'things.rock', pack: 'p', type: 'thing', fields: { kind: 'stone' } },
        undefined,
        { fields: { size: { default: 1 } } },
      ),
    ).toBe('**Rock** · stone ·  · 1 ft');
  });

  it('gives the best rendering: block and description, or either alone', () => {
    expect(text.contentCard(lamp)).toBe('**Lamp** · Light source · Heavy · burns oil\n\nIt glows.');
    expect(text.contentCard({ id: 'p:things.lamp', type: 'p:other' })).toBe('It glows.');
    expect(text.contentCard({ id: 'p:things.none', type: 'p:other' })).toBeUndefined();
    expect(text.contentBlock({ id: 'p:things.odd', type: 'p:thing' })).toBeUndefined();
    expect(text.value('p:thing', 'kind', 'light')).toBe('Light source');
    expect(text.value('p:thing', 'kind', 'dark')).toBe('dark');
  });

  it('reads arguments', () => {
    expect(messageArguments('{a} {b, select, x {{c}} other {}} {d, plural, other {#}}')).toEqual({
      ok: true,
      args: ['a', 'b', 'c', 'd'],
    });
    expect(messageArguments('{a').ok).toBe(false);
    expect(blockArgument('level_name', isField)).toEqual({
      kind: 'field',
      field: 'level',
      names: true,
    });
    expect(blockArgument('has_x', isField)).toEqual({
      kind: 'field',
      field: 'has_x',
      names: false,
    });
    expect(blockArgument('has_self_hp', isField)).toEqual({
      kind: 'has',
      of: { kind: 'self', key: 'hp', names: false },
    });
    expect(blockArgument('school', isField)).toBeUndefined();
    expect(blockArgument('tag_trait_cantrip', isField)).toEqual({
      kind: 'tag',
      spelled: 'trait_cantrip',
    });
  });

  it('tests a tag, and words a template', () => {
    const tagged = createText({
      languages: ['en'],
      spec: { en: {} },
      packs: {
        en: {
          p: {
            'types.thing.name': 'Thing',
            'types.thing.block':
              '{tag_size_big, select, true {Big} other {Small}} {tag_dark_glow, select, true {dark} other {plain}}',
            'runes.sharp.name': 'Sharp {base}',
            'runes.sharp.block':
              '**{name}** · +{bonus}{magic, select, true { · magic} other {}}{has_price, select, true { · {price}} other {}}',
          },
        },
      },
    });
    // A tag below the one named matches, and a pack prefix is dropped.
    expect(
      tagged.contentBlock({
        id: 'p:things.a',
        type: 'p:thing',
        tags: ['size.big.huge', 'p:dark-glow'],
      }),
    ).toBe('Big dark');
    expect(tagged.contentBlock({ id: 'p:things.b', type: 'p:thing', tags: ['size'] })).toBe(
      'Small plain',
    );
    expect(
      tagged.contentBlock({
        id: 'p:runes.sharp',
        type: 'template',
        appliesTo: { type: 'thing' },
        fields: { bonus: 2, magic: true, price: 'prior.price + 5' },
      }),
    ).toBe('**Sharp Thing** · +2 · magic');
    expect(tagged.contentBlock({ id: 'p:runes.dull', type: 'template' })).toBeUndefined();
  });
});

describe('5E', () => {
  const { ruleset, text } = load('5e/srd-5.1');
  const card = (id: string) => text.contentBlock(item(ruleset, `5e-srd-5.1:${id}`));

  it('words a spell card', () => {
    expect(card('spells.fire-bolt')).toBe(
      '**Fire Bolt** — *Evocation cantrip* · 1 action · 120 ft · V, S · Instantaneous',
    );
    expect(card('spells.shield')).toMatch(
      /^\*\*Shield\*\* — \*Level 1 Abjuration\* · 1 reaction, which you take when you are hit .* · Self · V, S · 1 round$/,
    );
    expect(card('spells.fireball')).toMatch(
      /^\*\*Fireball\*\* — \*Level 3 Evocation\* · 1 action · 150 ft \(20-ft sphere\) · V, S, M \(a tiny ball of bat guano and sulfur\) · Instantaneous$/,
    );
    expect(card('spells.detect-magic')).toBe(
      '**Detect Magic** — *Level 1 Divination (ritual)* · 1 action · Self (30-ft sphere) · V, S · Concentration, up to 10 minutes',
    );
    const full = text.contentCard(item(ruleset, '5e-srd-5.1:spells.fire-bolt'))!;
    expect(full.split('\n\n')[0]).toBe(card('spells.fire-bolt'));
    expect(full.split('\n\n')[1]).toMatch(/^You hurl a mote of fire/);
  });

  it('words equipment', () => {
    expect(card('weapons.dagger')).toBe(
      '**Dagger** — *Simple melee weapon* · 1d4 piercing · Range 20/60 ft · 2 gp · 1 lb',
    );
    expect(card('weapons.longsword')).toBe(
      '**Longsword** — *Martial melee weapon* · 1d8 slashing (two-handed 1d10) · 15 gp · 3 lb',
    );
    expect(card('armor.studded-leather')).toBe(
      '**Studded leather armor** — *Light armor* · AC 12 + Dex · 45 gp · 13 lb',
    );
    expect(card('armor.chain-mail')).toBe(
      '**Chain mail** — *Heavy armor* · AC 16 · Str 13 · Stealth disadvantage · 75 gp · 55 lb',
    );
    expect(card('armor.shield')).toBe('**Shield** — *Shield* · AC +2 · 10 gp · 6 lb');
  });
});

describe('orc-2e', () => {
  const { ruleset, text } = load('orc/2e');
  const r = ruleset as unknown as {
    content: Record<string, BlockItem>;
    contentTypes: Record<string, { fields?: Record<string, { default?: unknown }> }>;
  };
  // With the type, so its field defaults (Bulk 0, one hand, no range) fill the block.
  const card = (id: string) => {
    const found = r.content[`orc-2e:${id}`]!;
    return text.contentBlock(found, undefined, r.contentTypes[found.type]);
  };

  it('words spells, a cantrip and a feat', () => {
    expect(card('spells.blazing-bolt')).toBe(
      '**Blazing Bolt** — *Spell 2* · Attack, Concentrate, Fire, Manipulate, Arcane, Primal · 1 to 3 actions · Range 60 feet · 1 target · Defense AC',
    );
    expect(card('spells.caustic-blast')).toBe(
      '**Caustic Blast** — *Cantrip 1* · Acid, Cantrip, Concentrate, Manipulate, Arcane, Primal · 2 actions · Range 30 feet · Area 5-foot burst · Defense basic Reflex',
    );
    expect(card('spells.bless')).toBe(
      '**Bless** — *Spell 1* · Aura, Concentrate, Manipulate, Mental, Divine, Occult · 2 actions · Area 15-foot emanation · 1 minute',
    );
    expect(card('feats.general.shield-block')).toBe(
      '**Shield Block** — *General feat 1* · Reaction',
    );
  });

  it('words high-rank spells, a focus spell and a ritual', () => {
    expect(card('spells.chain-lightning')).toBe(
      '**Chain Lightning** — *Spell 6* · Concentrate, Electricity, Manipulate, Arcane, Primal · 2 actions · Range 500 feet · Defense basic Reflex',
    );
    expect(card('spells.mountain-resilience')).toBe(
      '**Mountain Resilience** — *Spell 4* · Concentrate, Earth, Manipulate, Arcane, Primal · 2 actions · Range touch · 1 target · 20 minutes',
    );
    expect(card('spells.inner-upheaval')).toBe(
      '**Inner Upheaval** — *Focus 1* · Concentrate, Focus, Monk, Uncommon · 1 action · Until the end of your turn',
    );
    expect(card('rituals.resurrect')).toBe(
      "**Resurrect** — *Ritual 5* · Healing, Uncommon · 1 day · Cost gems worth 75 gp × the target's level · Primary check Religion (expert) · Secondary casters 2 · Secondary checks Medicine, Society · Range 10 feet · 1 target",
    );
  });

  it('words a rune, a template with its own block', () => {
    expect(text.contentBlock(r.content['orc-2e:runes.flaming']!)).toBe(
      '**Flaming rune** — *Rune 8* · Magical, Property rune · 500 gp',
    );
    expect(text.contentBlock(r.content['orc-2e:runes.fortification']!)).toMatch(
      /^\*\*Fortification rune\*\* — \*Rune 12\* · .* · For medium or heavy armor · 2,000 gp$/,
    );
  });

  it('words equipment and a consumable', () => {
    expect(card('weapons.longbow')).toBe(
      '**Longbow** — *Martial ranged weapon* · 1d8 piercing · Group Bow · Range 100 feet · Two hands · Deadly, Volley · Bulk 2 · 6 gp',
    );
    expect(card('armor.chain-mail')).toBe(
      '**Chain Mail** — *Medium armor* · AC +4 · Dex cap +1 · Strength +3 · Check penalty –2 · Speed –5 feet · Group Chain · Flexible, Noisy · Bulk 2 · 6 gp',
    );
    expect(card('shields.buckler')).toBe(
      '**Buckler** — *Shield* · AC +1 · Hardness 3 · HP 6 (BT 3) · Bulk L · 1 gp',
    );
    expect(card('consumables.healing-potion-minor')).toBe(
      '**Healing Potion (Minor)** — *Potion 1* · Magical, Potion, Healing · Restores 1d8 HP · Bulk L · 4 gp',
    );
  });
});

type Loaded = ReturnType<typeof load>;
const packCard = ({ ruleset, text }: Loaded, id: string, copy?: BlockCopy) =>
  text.contentBlock(item(ruleset, id), copy);

describe('Forged in the Dark, Fate, MÖRK BORG and Mothership', () => {
  const card = packCard;
  const blades = load('fitd/scoundrel', 'fitd/crew');
  const fate = load('fate/core');
  const borg = load('mork-borg/core');
  const ship = load('mothership/1e');

  it("words a copy's state and computed values", () => {
    // The generic faction a GM names (the pack names none): its tier and hold come from the copy.
    expect(card(blades, 'fitd-crew:factions.faction')).toBe('**Faction** — *Tier 0* · Strong hold');
    expect(
      card(blades, 'fitd-crew:factions.faction', {
        state: { tier: 2, weakHold: true, status: -2 },
      }),
    ).toBe('**Faction** — *Tier 2* · Weak hold · Status -2');
  });

  it('words stunts, and stat lines from mechanics alone', () => {
    expect(card(fate, 'fate-core:stunts.ninja-vanish')).toBe(
      '**Ninja Vanish** — *Rules exception stunt* · Stealth · Once per scene · Costs a fate point',
    );
    expect(card(fate, 'fate-core:stunts.indomitable')).toBe(
      '**Indomitable** — *+2 stunt* · Will, Defend',
    );
    expect(card(borg, 'mork-borg-core:weapons.bow')).toBe(
      '**Bow** — *Ranged weapon* · 1d6 · Two-handed · Ammo: Arrows · 25s',
    );
    expect(card(borg, 'mork-borg-core:scrolls.unclean.daemon-of-capillaries')).toBe(
      '**Daemon of Capillaries** — *Unclean scroll* · 1d4 damage · 1d6 rounds · 50s',
    );
    expect(card(borg, 'mork-borg-core:classes.fanged-deserter')).toBe(
      '**Fanged Deserter** — *Class* · Strength 3d6+2, Agility 3d6-1, Presence 3d6-1, Toughness 3d6 · HP 1d10 · Omens 1d2 · 2d6 × 10s',
    );
    expect(card(ship, 'mothership-1e:skills.artificial-intelligence')).toBe(
      '**Artificial Intelligence** — *Master skill* · +20',
    );
    // MÖRK BORG and Mothership have no descriptions: the card is the block alone.
    expect(borg.text.contentCard(item(borg.ruleset, 'mork-borg-core:weapons.bow'))).toBe(
      card(borg, 'mork-borg-core:weapons.bow'),
    );
  });
});
