# Draw Steel Heroes

`@opencharacter/draw-steel-heroes` is an **unofficial** [Open Character Format](https://opencharacterformat.org/)
pack for MCDM's _Draw Steel: Heroes_. It is for apps that build, show and play Draw Steel heroes
with an OCF engine: characteristics and power rolls, abilities, Stamina and Recoveries, heroic
resources, conditions, kits, classes, ancestries, culture, careers and advancement.

The Open Character Format Draw Steel Heroes pack (draw-steel-heroes) is an independent product
published under the DRAW STEEL Creator License and is not affiliated with MCDM Productions, LLC.

## Install and load

```sh
pnpm add @opencharacter/draw-steel-heroes @opencharacter/engine
```

This release needs spec 0.3: `@opencharacter/engine` 0.3.0 or later.

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

- **Creation:** a guided start (the book's Quick Build picks recommended) and a random one, at any
  level from 1 to 10: ancestry with its point-buy traits, culture, career, class with its
  subclass, kit, characteristic array, skills, perks and every level's choices, and an optional
  complication.
- **Power rolls:** 2d10 plus a characteristic, in three tiers. Edges and banes are roll tallies:
  one is ±2, two or more move the tier, and they cancel as the book says. A natural 19 or 20 is
  tier 3; automatic tier outcomes and tier shifts. Tests read the tier against an easy, medium or
  hard difficulty; saving throws are 6 or higher.
- **Abilities:** all 607 abilities (class, kit, common, ancestry, perk, title, treasure,
  complication) share one `use-ability` action. It pays the cost and Spend, rolls once, and gives
  each target its own tier with the edges and banes it brings (prone, restrained, frightened,
  grabbed, taunted, marked); damage adds the characteristic, surges and the kit's bonus for that
  tier; conditions and other effects land behind potency; forced movement and distance are in the
  outcome. Content adds to an ability's forced movement, potency and distance through roll tallies
  (Forceful, Growing Ferocity, the psi boosts, Prayer of Distance). Abilities with rules beyond
  the tier table (Strained, persistent abilities, Judgment, Mark, routines, edicts, prayers,
  summons' numbers) add them on tagged steps or their own actions.
- **Classes:** the nine classes with their subclasses, heroic resources (including the Talent's
  negative clarity and strain), resource gains from their triggers, Growing Ferocity and
  Discipline Mastery tables, 10th-level epic resources, and the Censor's use of the Conduit's
  domains.
- **Stamina:** maximum from class, level and kit; winded, dying (and bleeding, unless a trait says
  otherwise) and dead; temporary Stamina (the greater kept); Recoveries, including Recoveries other
  heroes' abilities grant; damage immunity (by type, all damage, or "immunity all" to a type),
  weakness, and damage that can't be reduced.
- **Conditions and effects:** the nine conditions and other lasting effects (Setup's damage
  weakness), with duration (EoT, save ends, end of encounter, until the start or end of your next
  turn) and who imposed them; immunities keep them off the sheet; saving throws.
- **Combat:** start of combat, rounds and turns, Victories, experience and level-up, respite.
- **Kits:** the 21 kits and the 4 stormwight kits (with their animal forms' sizes); with two kits
  (Field Arsenal) one bonus of each kind counts.
- **Ancestries, culture, careers, perks, complications, titles, treasures:** every trait, aspect,
  career, perk, complication, title and treasure, with its numbers and choices.

## Text-only, and why

The book's text is on every item; these parts are the table's to apply, because the format has
no way to say them (each is a gap the project tracks):

- **Effects on other creatures' sheets:** auras and areas (the Null Field, Judgment's and Mark's
  benefits to allies, edicts on enemies), ending an effect you put on someone else, and anything
  triggered by another creature's turn or roll (most Troubadour drama events, "damage taken in
  one turn").
- **Positions:** areas, line of effect, cover, squares moved; forced movement is a number in the
  outcome, not a move.
- **Choices made at the table in the middle of an ability:** a damage type picked per use (Dragon
  Breath), Expanded and Shared psi boosts (area size, extra targets), new forced movement or a
  teleport an order or domain adds to Judgment.
- **Distance bonuses on abilities without a power roll** (the bonus rides on the roll).
- **Ignoring banes** a target brings (Manifold Resonance) and **edges against one target** of
  several from the user's own content.
- **A treasure a complication hands you** is taken by an item action, not by creation.

## Rule readings

- **A single edge or bane** isn't a roll item: the tier counts it, while the roll's total doesn't
  show the ±2.
- **Kit signature abilities** are written without the kit's damage and distance bonus, which the
  kit adds back like any weapon ability's.
- **Forced movement bonuses** add to every target's forced movement from the ability; one that
  should reach only some targets (Boren's grabbed target) applies when every target qualifies.
- **"While you have temporary Stamina from this ability"** (Kinetic Shield) reads as "while you
  have temporary Stamina": the sheet can't tell where it came from.
