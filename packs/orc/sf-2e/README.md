# Second Edition science-fantasy rules (ORC)

**Second Edition science-fantasy rules under the ORC License** (Player Core) as an
[Open Character Format](https://opencharacterformat.org/) pack, for apps that build, show and
play these characters with an OCF engine. Its rules compute the sheet (attributes, proficiencies,
AC, saves, skills, spellcasting, Bulk), and its actions create characters (guided or random),
level them to 20th, Strike (melee, guns with magazines and reloads, area and automatic fire),
cast spells, use skill actions, and buy, sell, implant and upgrade equipment. The book's setting
(its worlds, deities, factions, planes and characters) is left out.

## Install and load

```sh
pnpm add @opencharacter/engine @opencharacter/orc-sf-2e
```

The package's default export is the built pack (a `PackRelease`), and `i18n/en` its English
text:

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import orcSf2e from '@opencharacter/orc-sf-2e';
import en from '@opencharacter/orc-sf-2e/i18n/en';

const loaded = loadRuleset([orcSf2e]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { ruleset } = loaded;

// A new character, made by the random creation start: every pick is drawn, so it finishes.
const blank = {
  specVersion: '0.2.0',
  id: 'new-character',
  packs: [{ id: 'orc-sf-2e', version: '0.2.0' }],
  creating: true,
};
const created = startAction(ruleset, blank, {
  action: { id: 'orc-sf-2e:random-character' },
});
if (!('status' in created) || created.status !== 'finished') throw new Error('not finished');
const applied = applyChanges(
  ruleset,
  blank,
  created.proposedChanges.map((p) => p.change),
);
if (!applied.ok) throw new Error(JSON.stringify(applied.errors));

const sheet = computeSheet(ruleset, applied.character);
console.log(en['fields.hp.max.name'], sheet.values['orc-sf-2e:hp.max']?.value);
console.log(en['fields.defenses.ac.name'], sheet.values['orc-sf-2e:defenses.ac']?.value);
```

The guided start (`create-character`) pauses for each pick instead, and `level-up` raises the
level, asking what the new level brings. The [quick start](https://opencharacterformat.org/guides/quick-start/)
and the [guides](https://opencharacterformat.org/guides/) explain each call. Where the book
leaves a rule open, the pack's reading is listed under [Rule readings](#rule-readings).

## Scope at a glance

- **Covered:** Player Core, the player-facing book. GM Core is not covered.
- **Modeled:** the core math (attributes, proficiency, checks and degrees of success, bonus
  types, resistances, weaknesses and immunities, conditions with the book's new ones, dying and
  recovery, Bulk, Hero Points); all 10 ancestries with every heritage (the two versatile ones
  included) and ancestry feat; all 39 backgrounds; all 6 classes from 1st to 20th level with
  every class feat; the 6 multiclass archetypes with their feats; every general and skill feat;
  the skill actions, with Computers and Piloting; spontaneous spellcasting (connections and
  paradoxes, focus spells, innate spells, archetype sources, spell gems) with every spell; guns
  (magazines, reloading, area fire, automatic fire, kickback, modular weapons), weapon and armor
  grades, upgrades, augmentations, solarian crystals, materials, gear, grenades, medical items,
  serums and magic items; credits and investiture. Details in [What's modeled](#whats-modeled).
- **Text only:** the parts of options that are narrative or the app's (movement and positions,
  areas and auras, time, other creatures' sheets, what the GM decides), and options whose effect
  the format can't hold; see [Limitations](#limitations).
- **Out of scope:** GM Core; starship rules and starship roles; drones and companions as
  creatures of their own; the setting's proper nouns; the field agent archetype, whose every
  feat hangs on membership in a named organization.

## Structure

The pack is **standalone**. It shares the Second Edition engine rules with
[`orc-2e`](../2e/) (proficiency, checks, conditions, spellcasting, skill actions, Bulk), and
began as a fork of that pack's rules files, but it doesn't depend on it. A dependency would load
`orc-2e`'s content (its ancestries, classes, spells, items), and a science-fantasy sheet must not
offer fantasy content. The format can hide a dependency's content only item by item, and it
would still be in the ruleset. Where the two books print the same rule or item, this pack's
copy has the same shape as `orc-2e`'s, and the same text where the wording matches.

## Add-on packs

A pack that depends on `orc-sf-2e` can add to what it offers:

- **Subclasses:** a feature whose `classOption` names a class's choice (`envoy.leadership-style`,
  `mystic.connection`, `soldier.fighting-style`, `witchwarper.paradox`, `witchwarper.anchor`)
  joins it, and gear tagged `tool.compass` counts for Sense Direction.
- **Open enums** (`extendEnums`): `mystic.connection` and `witchwarper.paradox`, which a new
  connection or paradox sets with its own effect, as the core's do; weapon `group`,
  `damageType` and `ammoKind`, ammunition `kind`, armor `group`, consumable `category`,
  `damageType` and `persistentType`, spell damage types, affliction and persistent damage
  condition damage types, and feat `category`. A new damage type or group also needs its tag,
  declared and named in the add-on.
- **Choices** (`extendChoices`): written value and inline option choices take additions: the
  operative's `specialization`, the epiphany feats' `spell` (Basic, New, Advanced, Greater and
  Syncretic Epiphany), Additional Lore's `lore`, and the short skill lists. A new connection's
  epiphany counts for New Epiphany, Syncretic Epiphany and Realized Epiphany through rules
  effects on `mystic.otherExpertConnections`, `mystic.otherMasterEpiphanies` and
  `mystic.connectionRank`.
- **Skills and Lores:** a choice of any skill reads `skills.offered` and one of any Lore
  `skills.lores`; an add-on's Lore declares its fields (`skills.lore.<name>.rank`, `.mod`, …,
  as `rules/skills.yaml` does) and grants its tag into both with a rules effect.
- **Step tags** for rules-level `option` and `changes` effects: `creation.ancestry`,
  `creation.heritage`, `creation.background`, `creation.class` and `creation.finish` (guided and
  random creation), `level-up.gain`, and the actions' own (`strike.hit`, …).

Still closed: attributes, proficiency ranks, saves, spell traditions, weapon and armor
categories, the solarian's attunement and physical damage types for `versatile`, the game's
fixed sets; action parameters can't be open.

## License

- **License:** the ORC License. Its four notices (Article III) are in the manifest, which apps
  must pass on: the attribution is the pack's `credit`, and the other three are its `notices`
  (`orc`, `reserved-material` and `expressly-designated`). [`LICENSE`](LICENSE) carries them
  too, with where to find the license's text:

  > **ORC Notice:** This product is licensed under the ORC License located at the Library of
  > Congress at TX 9-307-067 and available online at various locations including
  > paizo.com/orclicense, azoralaw.com/orclicense, and others. All warranties are disclaimed as
  > set forth therein.
  >
  > **Attribution:** This product is based on the following Licensed Material: Starfinder Player
  > Core © 2025 Paizo Inc., Authors: Jessica Catalan, Thurston Hillman, Jenny Jarzabski, Mike
  > Kimmel, and Dustin Knight; Pathfinder Player Core © 2023 Paizo Inc., Designed by Logan Bonner,
  > Jason Bulmahn, Stephen Radney-MacFarland, and Mark Seifter. Authors: Alexander Augunas, Kate
  > Baker, Logan Bonner, Jason Bulmahn, Carlos Cabrera, Calder CaDavid, James Case, Eleanor
  > Ferron, Steven Hammond, Joan Hong, Vanessa Hoskins, James Jacobs, Jenny Jarzabski, Erik Keith,
  > Dustin Knight, Lyz Liddell, Luis Loza, Patchen Mortimer, Dennis Muldoon, Stephen
  > Radney-MacFarland, Mikhail Rekun, David N. Ross, Michael Sayre, Mark Seifter, Kendra Leigh
  > Speedling, Mark Thompson, Clark Valentine, Andrew White, Landon Winkler, and Linda
  > Zayas-Palmer. If you use our Licensed Material in your own published works, please credit us
  > as follows: Open Character Format, orc-sf-2e pack, © 2026 the Open Character Format
  > contributors.
  >
  > **Reserved Material:** Reserved Material elements in this product include all elements
  > designated as Reserved Material under the ORC License; the names "Starfinder", "Pathfinder"
  > and "Paizo" appear only in the attribution, to identify the Licensed Material.
  >
  > **Expressly Designated Licensed Material:** This product contains no Expressly Designated
  > Licensed Material.

  The fantasy Player Core is credited because the shared rules, and the one spell the book's
  lists name from it (_unfathomable song_), come through `orc-2e`'s modeling of it.

- **Reserved Material left out:** the setting (its worlds, star systems, deities, factions,
  organizations, planes, events and named characters). Rules names the book prints with a
  setting proper noun have neutral names here, taken from the book's own description where it
  gives one:
  - **Languages:** Lashunta (for the language of the lashuntas' home world), Barathu,
    Skittermander; place-named languages are left out, and their ancestries take a language of
    their choice instead.
  - **Heritages:** Desert World Kasatha, Dying World Survivalist, Coming-of-Age Kasatha, Chosen
    Pahtra, Castaway Shirren, Subterranean Skittermander, Scrapper Ysoki, Lost Planet Survivor
    Human.
  - **Feats:** Chosen Prismeni, Divine Rhythm, Battle Blessing, Steadfast Faith, Extra Devotion,
    Hyperspace-Touched, Hyperspace Hop, Hyperspace Blink, Hyperspace Strike, Frequent Hyperspace
    Traveler, Revitalized by Hyperspace, Cosmic Disciple, Glorious Evolution, Saint's Grip;
    Hyperspace Lore.
  - **Classes:** the Lost History witchwarper paradox.
  - **Equipment:** Chakram, Flaming Blade, Decorative Armor, Ceramic Suit, Scaled Plate, Travel
    Suit, Bulky Flight Suit, the dull yellow ore material; the ritual Forge Hyperspace Beacon.
- **Trademarks:** the pack's ID, folder and display name use no publisher's trademark. The
  source books' names appear only in the ORC attribution above; this pack is not affiliated with
  or endorsed by Paizo, and uses no logo or trade dress.
- **Text:** names, and short rules text written for the pack, in `i18n/en.yaml` and, split by
  area, `i18n/en/`. The ORC License would allow the book's own wording; the pack paraphrases.

## What's modeled

- **Attributes** are modifiers, from boosts and flaws as content (`boosts.str` …); the key
  attribute, the four boosts every five levels and the partial boost above +4 are the
  `advancement` rules'.
- **Proficiency** ranks drive Perception, saves, skills, attacks (simple, martial, advanced,
  unarmed, and simple, martial and advanced guns), armor and the class DC; level is added to
  trained and better.
- **Ancestries:** android, barathu, human, kasatha, lashunta, pahtra, shirren, skittermander,
  vesk and ysoki, with their Hit Points, size, Speed, boosts and flaws, languages, senses and
  heritages; borai and prismeni are versatile heritages. Ancestry feats' numbers (unarmed attacks,
  resistances, Speeds, senses, skill trainings, granted feats) are effects.
- **Backgrounds:** boosts, two trainings (a skill and a Lore) and a skill feat.
- **Classes:**
  - **Envoy:** directives (Get 'Em and the others, with Lead by Example), leadership styles,
    expertise, improvised mastery.
  - **Mystic:** connections (tradition, skill, a granted spell of each rank, epiphany focus
    spells), the vitality network (a pool of Hit Points with Transfer Vitality, regained each
    turn and on Refocus), transcendence.
  - **Operative:** Aim at a mark (precision damage by level, two marks with Dual Aim), the
    specializations and their exploits, Tactical Barrage.
  - **Solarian:** attunement (photon, graviton, perfect), the solar flare, nimbus and weapon (its
    group, damage type and traits re-forged as templates), solar crystals, solar shield.
  - **Soldier:** fighting styles, Area Fire and Auto-Fire with suppressing fire and the primary
    target, Walking Armory, bulwark.
  - **Witchwarper:** paradoxes (tradition, skill, a paradox spell of each rank, warp focus
    spells), anchors with their once-per-round anchoring effect, the quantum field.
- **Archetypes:** the six multiclass archetypes, with the dedication rule (a second dedication
  only after two other feats of the first), their class feats at half level, resiliency Hit
  Points, class DCs and spellcasting sources (mystic and witchwarper).
- **Feats:** every general, skill, ancestry and class feat is content with its prerequisites;
  176 of them also carry their mechanics (bonuses, proficiencies, trainings, actions, granted
  features and spells).
- **Skill actions:** the Second Edition actions and the book's new ones (Access Infosphere,
  Hack, Operate Device, Navigate, Plot Course, Stunt, Take Cover), each a check with its degrees.
- **Spellcasting:** spontaneous repertoires with slots, signature spells and heightening, focus
  points and Refocus, cantrips, innate spells, archetype sources, spell gems; 400 spells (36
  cantrips, 331 spells of 1st to 10th rank, 33 focus spells), 166 of them with mechanics beyond
  their numbers (damage and healing, effects, battle forms); 19 rituals.
- **Strikes:** the multiple attack penalty, every weapon trait the book uses (agile, analog,
  automatic, area, boost, deadly, fatal, kickback, modular, reload, unwieldy, volley …),
  magazines and ammunition, Area Fire and Auto-Fire with each target's basic Reflex save,
  critical damage, weapon specialization.
- **Equipment:** 86 base weapons with six grades each (templates: tactical to paragon), 22 armors
  with grades, 50 shields, 61 gear items, 122 consumables (grenades, medical items, serums,
  spell gems and ampoules, batteries and chem tanks, material ammunition), 58 augmentations
  (the implant limit, the one apex), 85 upgrades (templates, with the upgrade-slot limit), 21
  material templates, 41 worn and held magic items, 16 solarian crystals.
- **Money:** credits, plus UPBs as a separate field; buying, selling and the starting credits.

## Rule readings

Where the book leaves a rule open, or the format needs a choice the book doesn't make, the pack
reads it as below. These are the pack's provisional calls; a table may rule otherwise.

- **Random start:** the book has players choose, so the odds are the pack's, as in `orc-2e`:
  each pick is drawn uniformly among the options eligible then, in the guided start's order
  (except that the free boosts follow the class's picks, once the key attribute is known), and
  boosts follow the planned key attribute, then Constitution, Dexterity, Wisdom, Strength,
  Intelligence and Charisma.
- **Specialized Skill Set:** a slot can find no eligible feat (the specialization's skill has few
  skill feats, and some need a higher rank); it may be left empty.
- **Grades:** an item takes one weapon or armor grade (a template); a second grade is a rules
  issue. Shields' grades are separate items.
- **Additional Lore:** its increases at 3rd, 7th and 15th level are rank grants; a skill increase
  the player spends on that Lore beyond legendary is wasted, not refused.
- **Tech Support:** the background grants Quick Install though it trains Computers, not Crafting
  (Quick Install's prerequisite); the grant waives the prerequisite.
- **Mystic:** Transfer Vitality moves as many Hit Points as the target is missing, up to the
  limit and what the network holds, unless the player gives an amount; the mystic archetype's
  network regains Hit Points each turn and on Refocus as the class's does; the rhythm
  connection's 9th-rank spell (_unfathomable song_) is the fantasy core's. Elemental weapon and
  elemental barrier are applied to the caster with their element (Cast a Spell's `element`), the
  record of the active spell; what they give the target is text. While one is active, the
  elemental connection's wall of fire and absolute zero take its element's trait and first damage
  type (electricity, bludgeoning, fire, acid, cold, poison), a kept template per element.
- **Witchwarper:** the spellcasting attribute is the key attribute chosen; Core Memories'
  Assurance skill and In Another Life's ancestry feat are set by an action and kept until the
  player sets them again (the book's "during daily preparations").
- **Envoy archetype:** the directives come with their Lead by Example actions; the dedication's
  "without Lead by Example" is the player's to keep until Really Get 'Em!.
- **Area attacks:** the save DC is the class DC plus the weapon's tracking bonus, read once (a
  penalty to the class DC isn't applied twice).
- **Operative archetype:** Aim gives no extra damage until Sharpshooter, which gives 1d4 (2d4 at
  6th level).
- **Solarian archetype:** the solar flare is its own pair of items without Strength to damage.
- **Divine Bond:** deities are the setting's, so the feat's deity skill and spells are the
  player's to add.

## Limitations

- **Left to the app:** turns (it runs `start-turn` and `end-turn`), movement, reach, distances,
  areas and auras (who is in a burst, a quantum field, a harmony's emanation or a bond's range is
  the participants the app passes), cover and flanking (situational choices), when a condition
  is gained, daily preparations and rests, a spell's duration and sustaining (a spell or
  treatment for the next roll, such as guidance, sure strike or Treat Poison, ends on the roll it
  changes).
- **Text only:** critical specialization; the feats and features about movement, positions,
  other creatures' sheets, starships and drones; most harmony and quantum field effects; skill
  feats that change time or what the GM tells you; more than half the spells (utility,
  summoning, counteracting, illusions, areas over time); the rituals' outcomes; services.
- **Format gaps** (the pack works around it):
  - No upgrade step moves a pick from one choice to another, so saved picks can't follow a
    merged choice: the operative's specialization skill feat stays one copied choice per
    specialization.

## Sources

- **Rules:** Player Core, as presented by Archives of Nethys (2e.aonsrd.com), the official free
  rules reference, checked against it item by item.
- **ORC License:** the notices it requires, from the license's text (paizo.com/orclicense); the
  attribution lines as Archives of Nethys lists them.
