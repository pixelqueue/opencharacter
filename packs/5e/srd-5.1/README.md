# 5E System Reference Document 5.1

The **System Reference Document 5.1** (the 2014 fifth-edition rules Wizards of the Coast released
under Creative Commons) as an [Open Character Format](https://opencharacterformat.org/) pack, for
apps that build, show and play 5E characters and monsters with an OCF engine. Its rules
compute the sheet (scores, AC, hit points, spell slots, class resources), and its actions create
characters, level them, roll attacks, cast spells and rest. Only SRD content is here: the races,
classes, subclasses, spells and items that are in the Player's Handbook but not the SRD are left
out.

## Install and load

```sh
pnpm add @opencharacter/engine @opencharacter/5e-srd-5.1
```

The package's default export is the built pack (a `PackRelease`), and `i18n/en` its English
text:

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import srd from '@opencharacter/5e-srd-5.1';
import en from '@opencharacter/5e-srd-5.1/i18n/en';

const loaded = loadRuleset([srd]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { ruleset } = loaded;

// A new character, made by the random creation start: every pick is drawn, so it finishes.
const blank = {
  specVersion: '0.1.0',
  id: 'new-character',
  packs: [{ id: '5e-srd-5.1', version: '0.1.0' }],
  creating: true,
};
const created = startAction(ruleset, blank, {
  action: { id: '5e-srd-5.1:create-random-character' },
});
if (!('status' in created) || created.status !== 'finished') throw new Error('not finished');
const applied = applyChanges(
  ruleset,
  blank,
  created.proposedChanges.map((p) => p.change),
);
if (!applied.ok) throw new Error(JSON.stringify(applied.errors));

const sheet = computeSheet(ruleset, applied.character);
console.log(en['fields.hp.max.name'], sheet.values['5e-srd-5.1:hp.max']?.value);
```

The guided start (`create-character`) pauses for each pick instead; a monster is made with
`create-monster`. The [quick start](https://opencharacterformat.org/guides/quick-start/) and
the [guides](https://opencharacterformat.org/guides/) explain each call.

## Scope at a glance

- **Modeled:** abilities, skills and saves; creation (guided, random, point buy, standard
  array, rolled) and leveling to 20 with multiclassing; the nine races, the acolyte and the
  Grappler feat; all twelve classes and their SRD subclasses, feature by feature; all 319
  spells (slots, Pact Magic, damage, healing, saves, conditions, and 31 spells' effects on the
  creature they are cast on); weapons, armor, gear, tools, mounts and vehicles; the SRD magic
  items; conditions and diseases; combat, damage, resting and death saves; all 322 monsters,
  with their attacks, legendary actions, spellcasting and forms. Details in
  [What's modeled](#whats-modeled).
- **Text only:** the parts of spells, features and items that are narrative or the app's (turns,
  space, durations, other creatures' sheets); see [Limitations](#limitations).
- **Out of scope:** non-SRD content, artifacts, barding, services, and the 2024 rules; see
  [Omitted](#omitted).

## License

- **License:** CC-BY-4.0. Apps that show this pack's content must pass on its `credit`, which
  is the attribution the SRD 5.1 asks for:

  > This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by
  > Wizards of the Coast LLC and available at
  > https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under
  > the Creative Commons Attribution 4.0 International License available at
  > https://creativecommons.org/licenses/by/4.0/legalcode.

  [`LICENSE`](LICENSE) has it too, with the license's text.

- **Text:** names and short labels are in `i18n/en.yaml`. Descriptions are the SRD 5.1's own
  text, in Markdown: every spell, armor, adventuring gear, tools, the rowed vessels, class and
  subclass features, fighting styles, invocations, pact boons, racial traits, the background,
  the feat, magic items, the lance, the three diseases, classes, races, subraces and draconic
  ancestries. Where no one SRD text fits, the closest is used (each Ability Score Improvement has
  the class text naming its levels and the Feats chapter's sentence on taking a feat instead).
  Mounts, the other vehicles and trade goods have none: the SRD only lists them in tables. A
  spell's material component and a reaction's trigger are its named texts
  (`spells.<id>.texts.material`, `.texts.trigger`), and the weapon properties are tag text
  (`tags.finesse.name`, `.description`). Monsters' names and their traits' and actions' SRD text
  are in `i18n/en/monsters.yaml`, and the monster rules' labels in
  `i18n/en/monster-rules.yaml`.

## Rule readings

Where the SRD is unclear or silent, the pack reads it this way:

- **Ability maximum:** racial increases count toward the cap of 20 like Ability Score
  Improvements (only Primal Champion and the manuals and tomes raise it; items that set a score
  go past it). A score past its maximum is reported as `out-of-limits`, not clamped, and an
  Ability Score Improvement option that would pass 20 isn't offered.
- **Level-up hit points:** current hit points rise by what the maximum gains (hit die,
  Constitution, per-level bonuses), so a character at full health stays full.
- **The random start:** the SRD has no random character method; the odds are the pack's. Six
  rolls of 4d6 dropping the lowest go to the class's abilities by the priority table below;
  race, subrace, class, background, every pending pick and each starting-equipment line are
  drawn uniformly among the eligible options. A half-elf's two +1s go to the class's first two
  abilities by priority.
- **No proficiency twice:** a skill, language, tool or Expertise choice doesn't offer what the
  character already has (the SRD's "choose a different proficiency instead").
- **Competing AC:** armor, Unarmored Defense and Mage Armor compete and the highest is
  recommended; an app can pick another.
- **Extra critical dice:** Brutal Critical's and Savage Attacks' extra weapon dice are added once,
  not doubled.
- **Prone targets:** "within 5 feet" is read as a melee attack, beyond it as a ranged one.
- **Which slot pays:** without a slot type, a spell slot of the cast's level pays when one is
  left, else a pact slot; when both can, the player chooses (the pact slot recommended for a
  warlock spell).
- **Saves against magic:** Gnome Cunning's "against magic" is the `spellSave` choice; Fey
  Ancestry's "magic can't put you to sleep" blocks an unconscious condition applied by magic.
  Saves don't know the condition a spell or monster would apply: the player marks `charmSave`
  or `frightSave`.
- **Earlier charms and frights:** an immunity (Purity of Spirit, protection from evil and good,
  Mindless Rage) also blocks a condition applied before it, suspended until the immunity ends,
  where the SRD gives advantage on new saves.
- **Approximations:** Sacred Weapon applies to every weapon attack and Lifedrinker to every melee
  weapon attack (the app knows which weapon is the pact weapon); Favored Enemy's "two races of
  humanoid" is one pick; Sculpt Spells' spared target makes no save and takes no damage.
- **Sorcerer:** Flexible Casting only refills a spent slot; Empowered Spell rerolls, once, the
  lowest damage dice at or below half their faces; one Metamagic option per cast.
- **Ioun stones:** an increase "to a maximum of 20" adds only what fits under 20.
- **Death saves:** only while dying; monsters die at 0 hit points and never make one.
- **Monsters:** stat block numbers (to hit, damage, DC, AC) are as printed, not recomputed.
  Multiattacks that don't name their weapons are read as one weapon's (the erinyes, the
  gladiator's spear); the rakshasa's immunity to nonmagical weapons is read as nonmagical
  attacks.

## What's modeled

- **Abilities:** each ability has three fields:
  - `abilities.<a>.base` is the saved input. Racial increases and Ability Score Improvements add
    to it, and it is limited by the maximum.
  - `abilities.<a>.max` is 20. Primal Champion raises it by 4.
  - `abilities.<a>.score` is computed from the base. Items that set a score (Gauntlets of Ogre
    Power, the Belts of Giant Strength) set this field, so they go past the cap.
  - Modifiers, saving throws (proficiency as `save.<a>` tags) and the `saving-throw` action.
- **Character creation:** a guided start, `standard`, and a random one, `random`.
  `create-character` picks a race (and its subrace), a class at level 1 (the starting class),
  and a background, then the ability scores by one of the SRD's three methods:
  - **roll:** six rolls of 4d6 dropping the lowest, each given to a different ability;
  - **point buy:** every base score starts at 8, then up to 27 points with the SRD's costs
    (`[0, 1, 2, 3, 4, 5, 7, 9][amount]`), each score at most 15;
  - **standard array:** 15, 14, 13, 12, 10 and 8.

  Then what the race, class and background bring (a tool, a fighting style, skills, languages,
  a prepared caster's spells, …), one pick at a time; while creating, every pick must be made.
  Then the starting equipment: the class's "(a) or (b)" lines, each recommending (a), only the
  proficient options where the SRD says "if proficient", and the background's. Armor, a shield
  and every weapon come equipped; equipment packs come whole (`unpack` adds the contents). Coins
  are the app's: the pack doesn't track money. Hit points start at the class's full hit die and
  current hit points at the maximum. A character has at most one race and background and each
  class once; subraces, subclasses, fighting styles, improvements, invocations, pact boons,
  draconic ancestries and background features are only picked or granted, never added from a
  catalog.

- **The random start** (`random`, `create-random-character`): the guided start's steps with
  every pick recommended, so an automatic run finishes a legal 1st-level character. Ability
  scores go out by the class's priority, highest roll first, ties in roll order:

  | Class     | Priority                     |
  | --------- | ---------------------------- |
  | Barbarian | Str, Con, Dex, Wis, Cha, Int |
  | Bard      | Cha, Dex, Con, Wis, Int, Str |
  | Cleric    | Wis, Con, Str, Dex, Cha, Int |
  | Druid     | Wis, Con, Dex, Int, Cha, Str |
  | Fighter   | Str, Con, Dex, Wis, Cha, Int |
  | Monk      | Dex, Wis, Con, Str, Int, Cha |
  | Paladin   | Str, Cha, Con, Wis, Dex, Int |
  | Ranger    | Dex, Wis, Con, Str, Int, Cha |
  | Rogue     | Dex, Con, Wis, Int, Cha, Str |
  | Sorcerer  | Cha, Con, Dex, Wis, Int, Str |
  | Warlock   | Cha, Con, Dex, Wis, Int, Str |
  | Wizard    | Int, Con, Dex, Wis, Cha, Str |

  A class another pack adds takes the barbarian's.

- **Leveling up:** experience points are an input (`xp.current`), and `xp.nextLevel` is the
  SRD's table by total level. While the experience reaches it, `level-up` is a derived offer,
  one level at a time. It is offered at any level from 1 to 19 outside creation, so milestone
  groups ignore experience. It picks a class (one the character has, or a new one whose
  multiclassing prerequisite it meets along with every class it has), raises that class's
  level or adds the new class (with the multiclass proficiencies), and adds the hit die, rolled
  or fixed (half the die plus 1). What the level brings (a subclass, an Ability Score
  Improvement or the Grappler feat, spells, a fighting style) is asked last.
- **Core sheet:** level from the class copies; proficiency bonus from level, or from challenge
  rating for monsters; HP is the rolled hit dice (an input) plus Constitution × level; size,
  creature type, speeds, jumps, darkvision, languages, proficiencies; carrying weight and
  capacity (Strength × 15, by size).
- **Skills and checks:** all eighteen skills, with proficiency and expertise as tag sets;
  `ability-check`, `skill-check` and `initiative`. Each roll is tagged with its ability and
  skill, so armor's Stealth disadvantage applies. A failed check or save against a DC asks
  whether to use a feature that changes it (Stroke of Luck, Dark One's Own Luck).
- **Tools:** tool proficiencies are `proficiencies.tools`. A tool picked for a proficiency is a
  reference, not carried; each carried tool has a `tool-check` where the player names the
  ability. Jack of All Trades, Remarkable Athlete and Reliable Talent apply to it.
- **Combat:**
  - AC is 10 + Dexterity until something sets it.
  - `weapon-attack` uses Strength or Dexterity (finesse), proficiency, versatile damage and a
    critical range; a critical hit doubles the dice. A weapon with the ammunition property
    spends one piece of its kind per attack, hit or miss.
  - Advantage, disadvantage and a flat bonus are situational choices on every d20 test.
  - `unarmed-strike`: Strength and proficiency to hit, 1 + Strength bludgeoning; an unarmored
    monk uses Dexterity and the martial arts die.
  - **Targets:** `weapon-attack`, `cast-spell` and `breath-weapon` take targets as views. An
    attack reads the target's AC (else `targetAc`, else it asks hit or miss) and proposes its
    damage to that target. A save spell and the breath weapon roll damage once, hand each target
    its saving throw (run on its own sheet) and propose full or half damage. Without targets
    they return the damage, DC and save for the app.
  - **What attackers read from the target:** AC against ranged attacks, creature type,
    protection from evil and good, a sanctuary save the attacker must pass first, conditions
    (restrained, blinded, invisible, prone), Elusive, and item defenses.
  - **What the target's effects read from the damage:** melee or ranged, magical or not, the
    weapon's material, the wielder's alignment, and the save it followed (Evasion). An attack's
    damage is tagged `attack`, for reactions such as Uncanny Dodge.
  - **Damage and healing by hand:** `take-damage` and `heal`, so resistances, temporary hit
    points, concentration, damage at 0 hit points and Retaliation all apply.
  - **Falling:** `fall` deals 1d6 bludgeoning per 10 feet (at most 20d6), less Slow Fall, and
    leaves the creature prone; feather fall and the Ring of Feather Falling prevent it.
- **Conditions:** the SRD conditions are content applied through `applied`. Exhaustion is a
  field with an effect per level. An applied condition the creature is immune to is blocked
  and reported as `immune`. A condition entry records `by` (the creature type that applied it)
  and `magical`, for immunities that depend on them. Cackle fever, sewer plague and sight rot are
  conditions tagged `disease`.
- **Monsters:** all 322 SRD stat blocks, CR 0 to 30, plus the variants the SRD prints as a
  paragraph (the diseased giant rat, four insect swarms). A monster is a character with no
  class. `create-monster` copies a `monster` item's numbers into the sheet's inputs; the item
  sets AC, senses, XP and legendary actions and grants the traits and actions. `monster-attack`
  and `monster-effect` resolve attacks and saving throws on each target's sheet. Multiattacks
  run the attacks they name; legendary actions spend their cost; recharge and per-day actions
  are copies with their own state; Spellcasting and Innate Spellcasting cast with the printed
  numbers; the vampire and the lycanthropes change form. Languages only monsters speak aren't
  offered to players.
- **Resting:** `death-save`, `spend-hit-die`, `short-rest` and `long-rest` (spent hit dice back
  up to half the total level, the player choosing the classes).
- **Follow-ups:** concentration checks, a failed death save from damage at 0 hit points,
  Relentless Rage, Relentless Endurance, Undead Fortitude, Retaliation and the Berserker Axe's
  save, each once per batch of damage; a batch is one attack or spell as the app applies it.
- **Races and backgrounds:** the nine SRD races, four subraces and ten draconic ancestries, the
  Acolyte and the Grappler feat.
- **Classes:** all twelve classes and their twelve SRD subclasses, feature by feature. Uses
  until a rest are state on the class copy; per-roll bonuses are situational choices; lasting
  effects are boolean inputs; once per turn is the app's.
- **Spellcasting:** all 319 SRD spells as mechanics (level, school, class lists, casting time,
  range, components, duration, attack or save, damage and healing); class DCs and attack bonuses;
  spell slots by the multiclass table; Pact Magic; `cast-spell` with upcasting and cantrip
  scaling; concentration; 31 spells whose effects apply to their target's sheet; racial spells;
  subclass spells; the wizard's spellbook (a spell only in the book is cast only as a ritual).
- **Equipment:** every SRD weapon and armor, 135 gear items, 7 equipment packs, 35 tools, 8
  mounts and 11 vehicles, with cost (gp) and weight (lb) per unit. Extradimensional containers
  and the Efficient Quiver take what they hold out of carried weight.
- **Magic items:** the SRD 5.1 list, 318 files, 255 with mechanics. Magic weapons, armor,
  shields, ammunition and staffs are templates on the mundane item. Charges, daily properties,
  attunement (more than three, or an unmet requirement, is a rules issue), potions, oils and
  dusts, spells cast from items, item powers, on-hit charges, wounds, stored spells and
  situational advantages are modeled.
- **Sheet layout:** display groups for actions and content, with units (feet, pounds, gold
  pieces, miles per hour) and a compact `summary` view.

## Limitations

Of the 152 class and subclass features, 8 have no mechanics, and 63 of the 318 magic items are
text. Of the 319 spells, 200 do nothing on the sheet beyond spending the slot: what they do is
their SRD text, for the app and the table (detection, illusions, summoning, movement, utility).

- **The app's:** turns and action economy (Cunning Action, Fast Hands, Vanish, Persistent Rage,
  Nimble Escape; once per turn), the clock (durations, dawn, rests, crafting time), space and
  range (auras, areas, who is within reach), and other character files (summoned creatures,
  Wild Shape's beast, the vehicles that are creatures). Copying spells and crafting cost gold
  and days, the app's too.
- **Narrative or the GM's:** both Timeless Bodies, Tongue of the Sun and Moon, Trance, Shelter
  of the Faithful, and the text-only magic items.
- **Metamagic:** what most options change (Twinned Spell's second target, range, duration,
  casting time, components, Careful Spell's creatures) is reported in `data.metamagic` for the
  app.
- **Monster diseases:** the diseases a monster's attack gives (the diseased giant rat, the
  otyugh) are the attack's text. The hydra's bites per head are text: heads aren't tracked.

## Omitted

- **Non-SRD content:** races, subclasses, backgrounds, feats, spells and items that aren't in
  the SRD 5.1. Each SRD class has only its one SRD subclass.
- **The net:** it deals no damage, and the weapon type requires damage.
- **Artifacts, barding, services and lifestyle costs, container capacities.**
- **The 2024 rules** (SRD 5.2). This pack is the 2014 edition; a 5.2 pack would be its own pack.

## Sources

- **Rules:** the SRD 5.1 PDF.
- **Equipment and magic items:** the gear tables follow the SRD. The magic item list matches the
  SRD 5.1's "Magic Items A-Z" (the CC-BY release); rarity, attunement, charges, save DCs and
  the spells items cast were checked item by item.
- **Monsters:** the stat blocks and their text from the SRD 5.1 PDF, with the 5e-bits SRD data
  for structure, cross-checked against the PDF (the PDF wins where they differ). Each monster
  was built through the creation start and checked against the PDF.
- **Spell data:** generated from the 5e-bits SRD data (facts only, no text), checked against the
  SRD.
