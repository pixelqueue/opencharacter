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
  pass on its `credit` and its `permission` notice:

  > The Open Character Format Draw Steel Heroes pack (draw-steel-heroes) is an independent product
  > published under the DRAW STEEL Creator License and is not affiliated with MCDM Productions,
  > LLC. DRAW STEEL © 2026 MCDM Productions, LLC.
  - `permission`: the Draw Steel text, mechanics and rules, proper names included, are reused under
    the [DRAW STEEL Creator License](https://mcdm.gg/ds-license); no art, logos or page layouts
    are included.

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
  Justice You Fear). Choices made on each use are parameters: the psi boosts and taking the
  strain on any psionic ability (psi boosts are an extra cost paid with the use and counted by
  strain; taking the strain outside combat costs 1d6), Hurl Element's and Dragon Breath's damage
  type, Healing Grace's Spend enhancements (`graceRecoveries`, `graceStand`). Abilities with
  rules beyond the tier table (Strained, with its rolled damage, persistent abilities, Judgment,
  Mark, routines, edicts, prayers, summons' numbers) add them on tagged steps or their own
  actions. The uses are grouped by main action, maneuver and triggered action.
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
  Intuition and Healing Grace for a Conduit). Talent wards: Repulsive Ward offers its push and
  Vanishing Ward makes the hero invisible until the end of their next turn. Persistent Magic counts the damage taken in one
  turn (anyone's) until the turn changes, and 5 × Reason ends the maintained abilities.
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
  tactician's own rolls find its marks among the targets (Warmaster, focus).
- **The Null Field:** an aura on the enemies inside: their potencies drop by 1 (once, however many
  nulls), and Synaptic Break raises potencies used against them.
- **Hero tokens:** a party sheet (the `party` creation start) holds the pool; heroes link it and
  spend from it (surges, a failed saving throw, a test reroll, Stamina).
- **Kits:** the 21 kits and the 4 stormwight kits (with their animal forms' sizes); with two kits
  (Field Arsenal) one bonus of each kind counts, one kit's damage bonus across all three tiers.
- **Ancestries, culture, careers, perks, complications, titles, treasures:** every trait, aspect,
  career, perk, complication, title and treasure (100), with its numbers and choices. Armor and
  weapon treasures need a kit with a matching keyword (or Prayer of Soldier's Skill). A career's
  inciting incident is a choice of the book's six, each with its text. A treasure a complication
  hands you (Secret Twin, Cursed Weapon, …) is picked at creation and held as your own copy;
  Dragon Dreams' traits work from 5 Victories; Following in the Footsteps keeps a template on the
  idol's heroic ability (2 less, at least 1) and the neglected one (1 more), so cards, availability
  and the cost paid show it.

## Text-only, and why

The book's text is on every item; these parts are the table's to apply, because the format has
no way to say them (each is a gap the project tracks):

- **Effects on other creatures' sheets:** areas and the auras whose effects need positions or
  turns (Judgment's and Mark's benefits to allies, edicts on enemies, the Null Field's Inertial
  Anchor and Gravitic Disruption), and anything triggered by another creature's turn or roll
  (most Troubadour drama events, an ally damaging a creature you marked, an ally's heroic
  ability: the Tactician's `mark-damaged` and `ally-heroic`).
- **The Director's Malice** is the Director's; the null's discipline from it is an action the
  app runs.
- **Positions:** areas, line of effect, cover, squares moved; forced movement is a number in the
  outcome, not a move.
- **Choices made at the table in the middle of an ability:** Expanded and Shared psi boosts
  (area size, extra targets).
- **Extended Power on abilities without a power roll** (that boost rides on the roll), and
  distances that grow with level (King's Roar).
- **Talent:** Entropy Ward (it acts on the attacker's sheet) and Smolder's strained "can't use
  triggered actions".
- **Healing Grace:** ending an effect, and checking that the enhancements add up to the Spend.
- **No Dying on My Watch** records the target as frightened of the tactician, not of the ally who
  triggered it; **Inspiring Strike** offers only your own Recovery (the ally's, and the tier 3
  edges, are the table's).
- **Abilities a treasure grants** (King's Roar, Kuran'zoi Prismscale) aren't gated on the kit's
  keywords, since a grant can't read picks.
- **Ancestries:** the revenant's fall prone and 12-hour recovery, and a doomed hakaan's death at
  the encounter's end.
- **Eidetic Memory's** reset at each respite (the skill stays until re-picked), and **Knife of
  Nine's** growing bonus (+1 a hit on the same target, at most 3).
- **Typed damage on the card** of Hurl Element and Dragon Breath: their tier fields hold 0 and the
  damage comes from an effect tagged with the chosen type, since a roll effect can't retag the
  ability's own damage.

## Rule readings

- **A single edge or bane** isn't a roll item: the band set's total adds the ±2, so the log
  shows 15 for a 13 with an edge, and the dice total before it as `bounded`.
- **Kit signature abilities** are written without the kit's damage and distance bonus, which the
  kit adds back like any weapon ability's.
- **Forced movement bonuses** add to every target's forced movement from the ability; one that
  should reach only some targets (Boren's grabbed target) applies when every target qualifies.
- **"While you have temporary Stamina from this ability"** (Kinetic Shield) reads as "while you
  have temporary Stamina": the sheet can't tell where it came from.
