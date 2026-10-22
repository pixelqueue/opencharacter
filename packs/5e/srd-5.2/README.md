# 5E System Reference Document 5.2

The **System Reference Document 5.2.1** (the 2024 fifth-edition rules, released under Creative
Commons) as an [Open Character Format](https://opencharacterformat.org/) pack, for apps that
build, show and play 5E compatible characters and monsters with an OCF engine. Its rules compute
the sheet (scores, AC, hit points, spell slots, class resources), and its actions create
characters, level them, roll attacks with weapon mastery, cast spells and rest. Only SRD content
is here. It is its own pack: it doesn't depend on or mix with `5e-srd-5.1` (the 2014 rules).

## Install and load

```sh
pnpm add @opencharacter/engine @opencharacter/5e-srd-5.2
```

The package's default export is the built pack (a `PackRelease`), and `i18n/en` its English
text:

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import srd from '@opencharacter/5e-srd-5.2';
import en from '@opencharacter/5e-srd-5.2/i18n/en';

const loaded = loadRuleset([srd]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { ruleset } = loaded;

// A new character, made by the random start: every pick is drawn, so it finishes.
const blank = {
  specVersion: '0.2.0',
  id: 'new-character',
  packs: [{ id: '5e-srd-5.2', version: '0.2.0' }],
  creating: true,
};
const created = startAction(ruleset, blank, {
  action: { id: '5e-srd-5.2:create-character' },
  params: { random: true },
});
if (!('status' in created) || created.status !== 'finished') throw new Error('not finished');
const applied = applyChanges(
  ruleset,
  blank,
  created.proposedChanges.map((p) => p.change),
);
if (!applied.ok) throw new Error(JSON.stringify(applied.errors));

const sheet = computeSheet(ruleset, applied.character);
console.log(en['fields.hp.max.name'], sheet.values['5e-srd-5.2:hp.max']?.value);
```

The guided start (`standard`) runs the same action and pauses for each pick; a `level` parameter
starts higher. A monster is made with `create-monster`. The
[quick start](https://opencharacterformat.org/guides/quick-start/) and the
[guides](https://opencharacterformat.org/guides/) explain each call.

## Scope at a glance

- **Modeled:** abilities, skills, saves and every D20 Test (Heroic Inspiration, Exhaustion);
  creation (guided and random, at any level) and leveling to 20 with multiclassing; the nine
  species and their lineages, the four backgrounds, all 17 feats; all twelve classes and their
  SRD subclasses, feature by feature; all 339 spells (slots, Pact Magic, upcasting, cantrip
  upgrades, attacks, saves, healing, and the effects of buff spells on the creature they're on);
  weapons with their mastery properties, armor, tools, gear, mounts, vehicles and trinkets; the SRD
  magic items; conditions; combat, damage, resting and death saves; the SRD's monsters and
  animals. Details in [What's modeled](#whats-modeled).
- **Text only:** the parts of spells, features and items that are narrative or the app's (turns,
  space, durations, other creatures' sheets); see [Limitations](#limitations).
- **Out of scope:** non-SRD content, services and lifestyle, and the 2014 rules; see
  [Omitted](#omitted).

## License

- **License:** CC-BY-4.0. Apps that show this pack's content must pass on its `credit`, the
  attribution the SRD 5.2.1 asks for:

  > This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by
  > Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is
  > licensed under the Creative Commons Attribution 4.0 International License, available at
  > https://creativecommons.org/licenses/by/4.0/legalcode.

  [`LICENSE`](LICENSE) has it too, with the license's text.

- **Text:** names, prompts and labels are in `i18n/en.yaml` and `i18n/en/`. Descriptions are the
  SRD 5.2.1's own text, in Markdown: every spell, class and subclass feature, species trait,
  background, feat, weapon property and mastery property, tool, piece of gear, magic item and
  monster. A spell's material component and a reaction's trigger are its named texts
  (`spells.<id>.texts.material`, `.texts.trigger`). Mounts, vehicles and trinkets have only names:
  the SRD lists them in tables.

## Rule readings

Where the SRD is unclear or silent, the pack reads it this way:

- **Ability scores:** a background's increases and the Ability Score Improvement feat stop at 20
  (the `base` field's limit). Increases with a higher cap (Epic Boons to 30, Primal Champion and
  Body and Mind to 25) add to the `score` field, checked against their cap, so they stack past
  20; items that set a score go there too.
- **The random start:** six rolls of 4d6 dropping the lowest go to the class's abilities in the
  order of the SRD's Standard Array by Class table; class, background, species, every other pick,
  each starting-equipment "A or B" and the trinket (one die as large as the trinket table) are
  drawn uniformly. A background's +2 goes to its highest of the three abilities, the +1 to the
  next.
- **The guided start** recommends the Standard Array by Class (point buy at the same spread, 27
  points) and every pick the SRD recommends (a Fighting Style, an Epic Boon, Skilled for a human,
  the class's example weapon masteries).
- **Starting higher:** the character starts with the minimum experience for the level, and the
  level-up offers take it there one level at a time; levels 5 and up roll the extra gold of the
  Starting Equipment at Higher Levels table. Coins are tracked (`coins.*`), since a starting
  equipment choice can be gold.
- **Languages:** Common and the two standard languages are picked with the background.
- **Hit points:** current hit points rise by what the maximum gains on a level-up; a rolled hit
  die gains at least 1 after Constitution.
- **Heroic Inspiration** rerolls the d20 of a D20 Test (asked right after the roll); rerolling
  other dice is the app's.
- **Exhaustion:** −2 per level on every D20 Test (death saves included) and −5 feet of Speed per
  level; at 6 the sheet shows the creature dead.
- **Resistance, Immunity, Vulnerability** are sets of damage tags, each applied once per instance
  of damage however many sources grant it.
- **Prone targets:** "within 5 feet" is read as a melee attack, beyond it as a ranged one; a
  Paralyzed or Unconscious target's automatic Critical Hits likewise.
- **Weapon mastery** is offered after the attack roll (recommended). Sap ends with the target's
  next attack, Vex with the attacker's next attack against that target, and two Slows don't
  stack; their other timing is the app's. Push and Cleave are reported in the outcome (`push`,
  `cleave`) for the app to resolve; Cleave's attack runs the weapon's attack with `cleave` set.
- **Grapple and Shove:** the target saves with the better of Strength and Dexterity (its
  player's choice).
- **Death saves:** damage at 0 hit points from a Critical Hit counts two failures.
- **Temporary Hit Points** don't stack: `gain-temporary-hit-points` keeps the higher, and the
  features and spells that grant them (False Life's roll among them) go through it.
- **Spell slots:** without a slot type, a spell slot of the cast's level pays when one is left,
  else a pact slot; when both can, the player chooses (the pact slot recommended for a warlock
  spell). Free casts (once per Long Rest, species and feat spells) are offered as a cost option.
- **Paladin and Ranger** each round up their own half levels for the Multiclass Spellcaster
  table; Pact Magic stays separate.
- **Feats:** a feat that isn't repeatable is taken once, whether a background granted it or a
  level picked it. Savage Attacker is Advantage on the weapon's damage dice (exact for one die;
  for 2d6 it keeps the best two of three). A lineage's level 3 spell is a level 1 spell and its
  level 5 spell a level 2 one for its free casts.
- **Class features:**
  - Rage Damage, Reckless Attack and Brutal Strike count any attack using Strength, thrown
    weapons and Unarmed Strikes included.
  - Persistent Rage, Perfect Focus, Superior Inspiration, Evergreen Wild Shape and Boon of Fate
    act when Initiative is rolled (a hook on the `initiative` action); Uncanny Metabolism is its
    own action, since it rolls.
  - Focus Points are capped at the monk's level; Wholeness of Body's uses are at least 1.
  - Aura immunities (Courage, Devotion) lapse while the paladin is Incapacitated.
  - Holy Nimbus's restore is paying a level 5 slot; Superior Hunter's Defense halves damage only
    when not already resistant.
  - Reliable Talent counts a d20 below 10 as 10 on checks with proficiency; Stroke of Luck turns a
    failed test into a 20 (a Critical Hit on an attack).
  - Wild Shape can be used again while shape-shifted; its Temporary Hit Points don't stack.
    Turn Undead applies Frightened and Incapacitated on a failed save.
  - Thirsting Blade and Devouring Blade raise the attacks per Attack action, not only with the pact
    weapon. Pact of the Blade binds a weapon kind, which may attack with Charisma and deal Necrotic,
    Psychic or Radiant damage (picked on the attack, as Empowered Strikes' Force is); damage a
    feature or item adds in the weapon's type (Rage, Sneak Attack, a magic weapon's bonus) takes the
    picked type. Eldritch Spear's range, and Improved Elemental Fury's for a cantrip on the Druid
    list, go on the spell wherever the character knows it (another class's copy of the cantrip
    included).
  - A created spell slot (Font of Magic, Wild Resurgence, Nature Magician, Rod of Absorption)
    only refills an expended slot; Sorcery Points never pass their maximum.
  - Empowered Spell rerolls the lowest dice; Overchannel maximizes the spell's first damage die
    type.
  - A spell takes one Metamagic option, two with Sorcery Incarnate while Innate Sorcery is active,
    and Empowered Spell besides. Careful Spell spares targets the sorcerer picks (up to the
    Charisma modifier): they succeed and take no damage. Heightened Spell's Disadvantage goes to
    the first target. Transmuted Spell changes the spell's first damage type. Twinned Spell raises
    the effective level by one for a spell that targets more creatures from a higher slot; the
    app passes the extra target.
- **Spells:**
  - A spell's option (Hex's ability, Fire Shield's warmth, a resistance's type) is picked at the
    cast for each target, so Calm Emotions and an upcast Enhance Ability can differ per creature,
    and is kept on the applied spell. Only Alter Self's can be replaced later.
  - Enlarge/Reduce: only an unwilling target saves.
  - Black Tentacles' 3d6 is on a failed save only; a spell whose area is a wall or a square has
    no area shape.
  - Conjure Fey, Chromatic Orb, Eldritch Blast's later beams, Scorching Ray's rays, Magic
    Missile's darts and other repeated effects are their own actions on the spell; the cast is the
    first.
  - Death Ward ends when it saves its target: on the first damage that, before resistances,
    would drop the target to 0 Hit Points. Oil's extra fire damage ends with the first fire
    damage; Hypnotic Pattern and Eyebite's Asleep end on any damage.
  - Vampiric Touch heals half the damage rolled; Mass Heal gives out its 700 hit points one
    creature at a time.
  - A smite is an option on a hit with a melee weapon or an Unarmed Strike: picking it casts the
    spell (the slot level asked on the attack) and adds its damage to the attack's, doubled on a
    Critical Hit. Hex's and Hunter's Mark's extra damage joins the caster's attack damage when the
    target's view names the caster (`hex.cursedBy`, `huntersMark.markedBy`). Divine Favor doesn't
    add to Unarmed Strikes.
  - Power Word Kill and Power Word Stun read the target's current Hit Points from its view
    (without them, the outcome is the table's); a killed creature drops to 0 Hit Points with three
    failed Death Saving Throws.
  - Jump gives long and high jumps of at least 30 feet; Magic Weapon applies to every weapon
    until a weapon is named.
  - Telekinesis is cut off mid-sentence in the SRD 5.2.1; its text is finished with the SRD
    5.1's sentence.
- **Magic items:** "once per dawn" is tracked per item and reset by the `dawn` action; starting
  charges the SRD rolls start at the maximum; magic weapons, armor and shields are templates on
  the mundane item. The dwarf requirement is the Dwarf species.
- **Monsters:** stat block numbers (to hit, damage, DC, AC, Initiative) are as printed, not
  recomputed; where a printed number doesn't follow from the scores (the Gray Ooze's Initiative
  score, a few skills), an effect makes up the difference. Mind Blank is assumed cast before combat.
  A spell's saving throw tells the saver it is against a spell, so Magic Resistance gives Advantage
  on it and Greater Magic Resistance succeeds; a spell's attack roll against a creature with Greater
  Magic Resistance misses without a roll. Other magical effects stay the saver's choice (Magic
  Resistance's situational Advantage, the Rakshasa's option on a failed save). Conditions a grapple
  brings (Restrained, Blinded) are applied with it and ended by the app. A Multiattack's "replace
  one attack" replaces the last. A charge ("moved 20 feet straight toward") is its own action on the
  attack; a Multiattack's `charged` parameter makes its first attack the charge. The Half-Dragon's
  Multiattack adds each Claw's Draconic Origin damage, its type a parameter. A Priest Acolyte's spell save DC, which the SRD doesn't print, is 8 + Wisdom modifier +
  PB. The Hydra's heads are a parameter of its Multiattack. A size limit follows the stat block's
  words: "one Large or smaller creature" keeps a larger one out of the whole effect, while "if the
  target is Large or smaller" limits only the condition.

## What's modeled

- **Abilities:** `abilities.<a>.base` (the saved input; increases capped at 20 add here),
  `abilities.<a>.max` (20), `abilities.<a>.score` (what everything reads), modifiers, and
  `saves.<a>`, the save modifier (always-on save bonuses go there).
- **D20 Tests:** every ability check, saving throw and attack roll runs `d20-test`, tagged with
  what it is (`check.str`, `skill.stealth`, `save.dex`, `attack.melee`, `ability.str`, …). Heroic
  Inspiration, Exhaustion, Advantage and Disadvantage, and a hook after a failure (`failed-check`,
  `failed-save`, `failed-attack`) where features add a die, a bonus, a reroll, a 20 or a hit
  (Bardic Inspiration, Indomitable, Stroke of Luck, Peerless Aim, Legendary Resistance) act there.
- **Creation:** `create-character` picks a class, a background (its ability increases, origin
  feat, skills, tool and languages), a species and its lineage, the ability scores by the
  standard array, point buy or rolling, then every pick they bring, the starting equipment (each
  class's and background's "A or B", with their gold), a trinket and hit points. `random` draws
  everything; `level` starts higher.
- **Leveling up:** `xp.current` is an input and `xp.nextLevel` the SRD's table; while experience
  reaches it, `level-up` is offered (or run any time for milestone play). It picks a class (one
  the character has, or a new one whose primary abilities it meets, with every class it has),
  adds the hit die (fixed or rolled) and asks what the level brings: a subclass, feats, spells,
  weapon masteries, invocations.
- **Core sheet:** level, proficiency bonus (from challenge rating for monsters), hit points,
  Bloodied, size, creature type, speeds, senses, languages, proficiencies, carrying capacity by
  size (Powerful Build counts one larger), coins.
- **Skills, checks and tools:** all eighteen skills with proficiency and Expertise; ability,
  skill and tool checks (a tool adds proficiency, and Advantage with the skill too); Initiative.
- **Combat:** AC (armor, Unarmored Defense, Mage Armor and the like compete; the highest is
  recommended; a Shield needs training; armor without training gives Disadvantage on Strength and
  Dexterity tests and stops spellcasting); `weapon-attack` with finesse, thrown, versatile,
  ammunition spent per attack, Heavy and long range, the Light property's extra attack and Two-
  Weapon Fighting, and the eight mastery properties (Graze on a miss, Topple's save, Sap, Slow and
  Vex on the target, Push and Cleave reported, Nick the app's); `unarmed-strike`, `grapple`,
  `shove`, `escape-grapple`; critical hits double the dice. Attacks read the target's AC,
  conditions and defenses from its view and send damage to it split by type, tagged for its
  resistances and reactions. `take-damage`, `heal`, `gain-temporary-hit-points`, `fall`.
- **Conditions:** the fourteen SRD conditions as applied content (Incapacitated ends
  Concentration); Exhaustion as a field. Weapon mastery effects on a target are applied content
  too.
- **Resting:** `short-rest`, `long-rest` (all hit points and Hit Point Dice, slots, Exhaustion −1),
  `spend-hit-die`, `death-save`, and every feature's recharge, hooked to the rest.
- **Species, backgrounds and feats:** the nine species with their 24 lineages and ancestries
  (breath weapons, lineage spells, Giant Ancestry powers, Large Form, …), the four backgrounds, and
  the 17 origin, general, fighting style and epic boon feats.
- **Classes:** all twelve classes and their twelve SRD subclasses, levels 1–20, feature by
  feature: Weapon Mastery, Rage, Bardic Inspiration (a die given to another creature, used after
  a failed test), Channel Divinity, Wild Shape, Fighting Styles, Martial Arts and Focus, Lay On
  Hands and smites, Favored Enemy, Sneak Attack and Cunning Strike, Font of Magic and the ten
  Metamagic options, Pact Magic and the 28 invocations, the spellbook, Arcane Recovery. Uses until
  a rest are state on the class copy, an invocation's on its pick (Gift of the Depths' `used`).
  A species trait keeps its own uses as its grant's saved state (Breath Weapon, Draconic Flight,
  Stonecunning, the lineage spells, Giant Ancestry, Large Form, Adrenaline Rush, Relentless
  Endurance); Stone's Endurance spends a Giant Ancestry use from its incoming-damage effect's
  `then`, and `origins.giantAncestryLeft` offers it while one is left.
- **Spellcasting:** each class's cantrips and prepared spells (the table's counts), always-
  prepared subclass spells, the Multiclass Spellcaster slots, Pact Magic, the wizard's spellbook
  and Ritual Adept, Magic Initiate and species spells with their own ability, `cast-spell` with
  upcasting and cantrip upgrades, Concentration (checks at DC 10 or half the damage, up to 30),
  196 of the 339 spells with mechanics beyond spending the slot.
- **Equipment:** 38 weapons with their properties and mastery, 13 armors, 37 tools, 96 pieces of
  gear (ammunition, spellcasting focuses, equipment packs that `unpack`, thrown flasks, the
  Healer's Kit, Antitoxin, Basic Poison), 8 mounts, 12 vehicles and 100 trinkets, with cost (GP)
  and weight (lb) per unit.
- **Magic items:** the SRD 5.2.1 list as 323 files (variants split), 273 with mechanics: magic
  weapons, armor and shields as templates, attunement (at most three; class and spellcaster
  requirements), charges and recharge, daily powers, potions, scrolls, spells cast from items,
  stored spells, resistances, set ability scores and situational advantages.
- **Monsters:** all 330 SRD stat blocks, monsters and animals. A monster is a character with no
  class:
  `create-monster` copies a `monster` item's stat block into the sheet, and each trait and action
  becomes its own copy with its uses or recharge. `monster-attack` and `monster-effect` resolve
  attacks and saving throws on each target's sheet; Multiattack, legendary actions (with lair
  numbers), Legendary Resistance, Magic Resistance and Spellcasting work.
- **Sheet layout:** display groups for fields, actions and content, units, and a headline
  ("Level 3 Elf Wizard", "Goblin Warrior, CR 1/4").

## Limitations

Of the 339 spells, 143 do nothing on the sheet beyond spending the slot: what they do is their
text, for the app and the table. Of the 323 magic item files, 50 are text. Class features left
as text are listed below.

- **The app's:** turns, action economy and once-per-turn limits (Cunning Action, Instinctive
  Pounce, Tactical Shift, Nick, Fast Hands, Steady Aim, Thief's Reflexes, Bonus Action attacks),
  durations and round-by-round effects (Rage's extension, repeated saves, damage each turn,
  Sacred Weapon's and Holy Nimbus's timers kept as toggles), space and movement (auras for
  allies, pushes, teleports, areas, walls, Halfling Nimbleness), and other characters' sheets
  (summoned creatures, familiars, mounts and steeds, Wild Shape's beast, allies in an aura).
- **Spells left as text, by kind:** detection and divination, illusions, summoning and creation,
  movement and travel, wards and areas, utility, raising the dead, and spells that remake a weapon
  or a form (Shillelagh, True Strike, Shapechange). Also text: extra targets and longer durations
  from higher slots, Enlarge/Reduce's size change, Chill Touch's no-regain, Beacon of Hope's
  maximum healing, Heroism's temporary hit points each turn, a second damage type for Transmuted
  Spell.
- **Metamagic:** Distant, Quickened and Subtle Spell are recorded in the cast's `data.metamagic`
  for the app.
- **Monsters:** movement and sense traits, revival traits, reactions that change a roll (Parry),
  pushes and pulls, Swallow beyond its conditions, wounds, curses and damage over time,
  escalations on a second failed save, healing equal to damage dealt, a lost Hit Point maximum,
  lycanthrope curses, vampire weaknesses and once-per-turn limits on legendary actions are text.
  Gear quantities and language dialects aren't stored.

## Omitted

- **Non-SRD content:** species, subclasses, backgrounds, feats, spells and items that aren't in
  the SRD 5.2.1. Each class has only its one SRD subclass.
- **Services and lifestyle:** food, lodging, hirelings, spellcasting services and lifestyle
  expenses; crafting, brewing and scribing are the app's (their costs and times are text).
- **The 2014 rules** (SRD 5.1), which are the `5e-srd-5.1` pack.

## Sources

- **Everything:** the SRD 5.2.1 PDF, read item by item. The 2014 pack's files served as modeling
  patterns only; where they differ, the SRD 5.2.1 wins.
