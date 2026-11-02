# Draw Steel Heroes

`@opencharacter/draw-steel-heroes` is an **unofficial** [Open Character Format](https://opencharacterformat.org/)
pack for MCDM's _Draw Steel: Heroes_. It is for apps that build, show and play Draw Steel heroes
with an OCF engine: characteristics and power rolls, abilities, Stamina and Recoveries, heroic
resources, conditions, kits, classes, ancestries, culture, careers and advancement.

The Open Character Format Draw Steel Heroes pack (draw-steel-heroes) is an independent product
published under the DRAW STEEL Creator License and is not affiliated with MCDM Productions, LLC.
DRAW STEEL © 2026 MCDM Productions, LLC.

## Install and load

```sh
pnpm add @opencharacter/draw-steel-heroes @opencharacter/engine
```

This release needs spec 0.4: `@opencharacter/engine` 0.4.0 or later. An engine for an older
spec refuses it (`spec-version-unsupported`).

The package's default export is the pack's release, ready for `loadRuleset`; its English text is
`@opencharacter/draw-steel-heroes/i18n/en` (also as JSON, `release.json` and `i18n/en.json`).

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import heroes from '@opencharacter/draw-steel-heroes';

const loaded = loadRuleset([heroes]);
if (!loaded.ok) throw new Error(loaded.errors.map((e) => e.code).join(', '));
const { ruleset } = loaded;

// A random hero: every pick drawn.
const blank = {
  specVersion: '0.3.0',
  id: 'hero',
  packs: [{ id: 'draw-steel-heroes', version: '0.1.0' }],
  creating: true,
};
const run = startAction(ruleset, blank, {
  action: { id: 'draw-steel-heroes:create-hero' },
  params: { random: true },
});
if (!('status' in run) || run.status !== 'finished') throw new Error('creation paused');
const made = applyChanges(
  ruleset,
  blank,
  run.proposedChanges.map((p) => p.change),
);
if (!made.ok) throw new Error('creation failed');
computeSheet(ruleset, made.character).values['draw-steel-heroes:stamina.max']?.value;
```

## License

- **License:** `LicenseRef-draw-steel-creator-license`. Apps that show this pack's content must
  pass on its `credit` and its `permission` notice.
- **Credit:**

  > The Open Character Format Draw Steel Heroes pack (draw-steel-heroes) is an independent product
  > published under the DRAW STEEL Creator License and is not affiliated with MCDM Productions,
  > LLC. DRAW STEEL © 2026 MCDM Productions, LLC.

- **Notice (`permission`):**

  > The DRAW STEEL text, mechanics and rules in this pack, proper names included, are reused
  > under the DRAW STEEL Creator License (https://mcdm.gg/ds-license). No art, logos or page
  > layouts are included.

[`LICENSE`](LICENSE) says the same.

## What's modeled

- **Creation:** a guided start and a random one, at any level from 1 to 10. The guided start
  recommends the book's Quick Build picks for each class (subclass, kit, characteristics, skills,
  perks, abilities); the book has none for ancestry, culture or career, so those recommend the
  first option, for the player to change. Both cover ancestry with its point-buy traits, culture, career, class with its
  subclass, kit, characteristic array, skills, perks and every level's choices, and an optional
  complication.
- **Power rolls:** 2d10 plus a characteristic, in three tiers. Edges and banes are roll tallies:
  one is ±2 (in the reported total), two or more move the tier, and they cancel as the book says.
  A natural 19 or 20 is tier 3; automatic tier outcomes, tier shifts and minimum tiers (Area of
  Expertise). Tests read the tier against an easy, medium or hard difficulty; saving throws are 6
  or higher, offered on each save-ends condition or effect.
- **Abilities:** all 605 abilities (class, kit, common, ancestry, perk, title, treasure,
  complication) share one `use-ability` action. It rolls once and gives each target its own tier
  with the edges and banes it brings (prone, restrained, frightened, grabbed, taunted, marked,
  and content's own: Executioner's Blade against a winded target, The Harder They Fall against a
  large one), then pays the cost and Spend, so the Shadow's insight discount and an
  Elementalist's maintained abilities cost what they should, and a use that can't pay ends.
  Damage adds the characteristic, surges (checked against those held, spent only on rolled
  damage) and the kit's bonus for that tier; 2 more surges raise one target's potency by 1
  (`potencySurge`); conditions and other effects land behind potency; forced movement, a teleport
  and distance are in the outcome. A grabbed or taunted hero's bane counts when the grabber or
  taunter isn't among the targets.
  Content adds to an ability's forced movement, potency and distance through roll tallies
  (Forceful, Growing Ferocity, the psi boosts, Prayer of Distance), sets them on a hit (Judgment's
  Paragon pull and Exorcist teleport, King's Roar) or replaces a condition ("instead": It Is
  Justice You Fear). `use-ability` takes `characteristic`, `mode` (melee or ranged), `spend`,
  `surges`, `potencySurge` and `downgrade`. Other choices made on each use are parameters content
  adds:
  - `talentStrain` (taking the strain on any psionic ability; outside combat it costs 1d6) and
    the psi boosts `psiDynamic`, `psiExpanded`, `psiExtended`, `psiHeightened`, `psiMagnified`,
    `psiShared` and `psiSharpened` (an extra cost paid with the use and counted by strain).
  - The damage type of Hurl Element (`element`), Dragon Breath (`breathType`) and Smolder
    (`smolderType`), typing the ability's own damage so the card shows the real numbers.
    Visceral Roar and Deluge take the stormwight kit's primordial type (`fury.primordialType`),
    and Deluge's ignores immunity.
  - Healing Grace's Spend enhancements: `graceRecoveries`, `graceStand` and `graceEnd`, which
    must fit in `spend` (they bound it: an overspend is `out-of-range` on `spend`).
    `graceEndEntry` is the ID of the applied entry to end on the target; without it, the first
    that a saving throw or the end of a turn ends.
  - No Dying on My Watch's `adjacentEnemies`: the ally gains 5 temporary Stamina for each.

  An `ally` participant is the ally a triggered ability answers or an ability helps: No Dying on
  My Watch's target is frightened of that ally, who spends a Recovery; Inspiring Strike lets them
  spend one. Abilities with
  rules beyond the tier table (Strained, with its rolled damage, persistent abilities, Judgment,
  Mark, routines, edicts, prayers, summons' numbers) add them on tagged steps or their own
  actions. The uses are grouped by main action, maneuver and triggered action; a hero who can't
  use triggered actions (dazed, slowed by an Entropy Ward, Smolder's strain) has none offered.

- **Ability cards:** each tier's text names this hero's damage (characteristic and kit included),
  potency and distance, from the ability's computed values, and the book's wording without a
  hero. Range bonuses (Omnisensory, Remote Amplification, Prayer of Distance, the Elementalist's
  distance features) are sheet fields the card reads, reaching abilities without a roll too; an
  area's bonus goes to its range ("within"), not its size.
- **Classes:** the nine classes with their subclasses, heroic resources (including the Talent's
  negative clarity and strain), resource gains from their triggers, Growing Ferocity and
  Discipline Mastery tables, 10th-level epic resources, and the Censor's use of the Conduit's
  domains: the Censor's domain grants the Conduit's domain features as the hero levels, and their
  text and numbers read the holder's class (Presence and My Life for Yours for a Censor,
  Intuition and Healing Grace for a Conduit). The Censor gains wrath when the creature they
  judged damages them (the damage names its dealer). Talent wards: Repulsive Ward offers its push,
  Vanishing Ward makes the hero invisible until the end of their next turn, and Entropy Ward
  slows whoever damaged the hero (a follow-up the app runs on that creature's sheet: speed down by
  the talent's Reason and no triggered actions until the end of its next turn). Persistent Magic
  counts the damage taken in one turn (anyone's) until the turn changes, and 5 × Reason ends the
  maintained abilities.
- **Reactions that reduce damage** are situational choices on the incoming damage, selected on
  the attack's first change and reaching the whole attack: Parry (`parry`), Skin Like Castle
  Walls (`skinLikeCastleWalls`), Unearthly Reflexes (`furyHalfDamage`), Defensive Roll and In All
  This Confusion (`shadowHalfDamage`), Draconian Guard (`draconianGuard`), Resist the Unnatural
  (`resistTheUnnatural`), and the null's Inertial Shield (`inertialShield`), Inertial Absorption
  (`inertialAbsorption`) and Synaptic Anchor (`synapticAnchor`). Inertial Absorption and Synaptic
  Anchor pay their 11 discipline in the choice, and Inertial Absorption gains 3 surges; outside
  combat they use the ability up until a respite, as a heroic ability's use does. Damage is halved once however many
  halve it, and weakness and immunity apply after the halving (immunity last). Elemental
  Absorption's immunity meets each elemental change of the attack whole, and Elemental Buffer's
  surges come when immunity reduces elemental damage, Elemental Absorption's included.
- **Other situational choices:** `edges`, `banes` and `bonus` on any power roll (the
  Director's), `conduitPray` (praying before the piety roll), `shadowConditionMet` (a shadow
  ability's own condition holds: its surge), `kineticAmplifier` (surges spent on forced movement)
  and `psionNoStrainDamage` (a psion takes no damage from negative clarity).
- **Stamina:** maximum from class, level and kit; winded, dying (and bleeding, unless a trait says
  otherwise) and dead; temporary Stamina (the greater kept); Recoveries, including Recoveries other
  heroes' abilities grant; damage immunity (by type, all damage, or "immunity all" to a type),
  weakness (the highest that applies), and damage that can't be reduced. Immunities from
  treasures, complications, titles and class features don't stack: the highest counts. A
  revenant at the death threshold is inert, not dead (fire then destroys it), and a doomsight
  hakaan turns to rubble.
- **Conditions and effects:** the nine conditions and other lasting effects (Setup's damage
  weakness), with duration (EoT, save ends, end of encounter, until the start or end of the
  imposer's next turn, on anyone: the `turn-boundary` clock action ends them) and who imposed
  them; immunities keep them off the sheet; saving throws.
- **Combat:** start of combat, rounds and turns, Victories, experience and level-up, respite
  (not for a dead hero).
- **Marks:** the Tactician's marks are entries the tactician applied; a new Mark ends the earlier
  ones wherever they are, and dying ends them all. Any hero's power roll against a marked target
  has an edge (whether the hero is within the tactician's line of effect is the table's), and the
  tactician's own rolls find its marks among the targets (Warmaster, focus). On the tactician's
  damage roll, the `markDamage` situational choice spends 1 focus for twice their Reason in extra
  damage to the first target. The `mark-benefit` action spends 1 focus for another benefit:
  extra damage or a shift as outcome numbers, a Recovery when the damage was the tactician's, or a
  taunt on the target. An ally damaging a
  creature the tactician marked offers its focus, for an app that routes other characters'
  events (`observes`); without it, `mark-damaged` is an action the table runs.
- **Auras:** the Null Field on the enemies inside: their potencies drop by 1 (once, however many
  nulls), and Synaptic Break raises potencies used against them. Auras an ability casts are the
  ability applied to its user, one aura per cast: Blessing of Steel (damage immunity 5 and a bane
  on ability rolls against you and your allies inside), Blessing of the Midday Sun (a bane on
  enemies' power rolls), Blessing of Secrets (a double edge to hide and sneak) and Swarm of
  Spirits (allies resist potencies as if 1 higher, +1 on saving throws).
- **Hero tokens:** a party sheet (the `party` creation start) holds the pool; heroes link it and
  spend from it (surges, a failed saving throw, a test reroll, Stamina).
- **Kits:** the 21 kits and the 4 stormwight kits (with their animal forms' sizes); with two kits
  (Field Arsenal) one bonus of each kind counts, one kit's damage bonus across all three tiers.
- **Ancestries, culture, careers, perks, complications, titles, treasures:** every trait, aspect,
  career, perk, complication, title and treasure (100), with its numbers and choices. Armor and
  weapon treasures need a kit with a matching keyword (or Prayer of Soldier's Skill), abilities
  they grant (King's Roar, Kuran'zoi Prismscale) included. Brawny and Lucky Dog are offered after
  a failed test they apply to (both on one test): each loses 1d6 + level Stamina and improves the
  test one tier.
  Eidetic Memory's lore skill is picked anew at each respite. A career's
  inciting incident is a choice of the book's six, each with its text. A treasure a complication
  hands you (Secret Twin, Cursed Weapon, …) is picked at creation and held as your own copy;
  Dragon Dreams' traits work from 5 Victories; Following in the Footsteps keeps a template on the
  idol's heroic ability (2 less, at least 1) and the neglected one (1 more), so cards, availability
  and the cost paid show it.

## Add-on packs

A pack that depends on `draw-steel-heroes` can add content of its types: creation offers every
ancestry, culture, career, class and complication of the ruleset, in the guided picks and in the
random draws, and every ability shares the `use-ability` action.

- **Open enums** (`extendEnums`): `heroic.kind`, a class's `resource`, and an ability's `usage`,
  `kind`, `resource`, `distanceKind` and `damageType`. An add-on lists new values in
  `extendEnums` and names them in its text.
- **Naming what an add-on adds:** it names each added value, option or key in its own text,
  under the key this pack would use, and `createText` finds it there when the app passes the
  ruleset's `enumOrigins`, `optionOrigins` and `familyOrigins`.
- **Abilities:** `use-ability` carries the tags `ability`, `usage.<usage>` and the ability's own
  keywords (`kw.*`), so a `params` effect can add a parameter to some abilities. Its power roll
  is tagged `power-roll.ability` (each target's banding `power-target`), and its damage `damage`
  with the part `ability.damage`.
- **Tagged steps** take an add-on's rules-level `changes` effects: `ability.extra` (an extra cost
  for this use, as `flags.extra`), `ability.pay` (costs), `ability.spend` (a Spend paid),
  `ability.hit` (per target, after damage and conditions), `ability.after` (once, at the end),
  `combat.start`, `round.start`, `turn.start`, `turn.end`, `turn.boundary` (each turn change),
  `combat.end`, `respite`, `level-up`, `test.improve` and `test.improved` (a failed test improved
  after the roll).

## Rule readings

- **A single edge or bane** isn't a roll item: the band set's total adds the ±2, so the log
  shows 15 for a 13 with an edge, and the dice total before it as `bounded`.
- **Kit signature abilities** are written without the kit's damage and distance bonus, which the
  kit adds back like any weapon ability's.
- **Forced movement bonuses** add to every target's forced movement from the ability; one that
  should reach only some targets (Boren's grabbed target) applies when every target qualifies.
- **"While you have temporary Stamina from this ability"** (Kinetic Shield) reads as "while you
  have temporary Stamina": the sheet can't tell where it came from.

## Limitations

The book's text is on every item. These parts are the table's to apply. Some are outside the
format (positions, the Director's side); the others are gaps, linked where an issue is open.

- **Effects on other creatures' sheets:** areas and the auras whose effects need positions or
  turns (Judgment's benefits to allies, Mark's extra damage and shift on an ally's strike, edicts
  on enemies, the Null Field's Inertial Anchor and Gravitic Disruption, the surges and Recoveries
  auras hand out at turns). Synaptic Anchor's daze is its ability's use against the creature.
- **Triggers on another creature's turn, roll or ability use:** most Troubadour drama events and
  an ally's heroic ability (the Tactician's `ally-heroic`) are actions the app runs
  ([#187](https://github.com/pixelqueue/opencharacter/issues/187)). The first hero winded and
  damage to a villain need the observed creature's state or kind, which the observed event
  doesn't carry ([#255](https://github.com/pixelqueue/opencharacter/issues/255)); the
  `drama-event` action records them.
- **Bonus damage on a chosen-type ability** is untyped, so immunity and weakness skip it: Acolyte
  of Fire and Master of Fire on Dragon Breath and Smolder, and Enchantment of Destruction and
  Force Augmentation on all of them. Only Hurl Element is special-cased
  ([#254](https://github.com/pixelqueue/opencharacter/issues/254)).
- **The Director's Malice** is the Director's; the null's discipline from it is an action the
  app runs.
- **Positions:** areas, line of effect, cover, squares moved; forced movement is a number in the
  outcome, not a move.
- **Choices made at the table in the middle of an ability:** Expanded and Shared psi boosts
  (area size, extra targets).
- **Extended Power on abilities without a power roll** (that boost rides on the roll), and
  distances that grow with level (King's Roar).
- **Healing Grace's extra targets:** the player counts them in `spend`; nothing checks that they
  fit. Inspiring Strike's tier 3 edges are the table's.
- **Ancestries:** the revenant's fall prone and 12-hour recovery, and a doomed hakaan's death at
  the encounter's end.
- **Knife of Nine's** growing bonus (+1 a hit on the same target, at most 3).
