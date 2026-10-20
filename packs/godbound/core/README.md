# Godbound

`@opencharacter/godbound-core` is an **unofficial** [Open Character Format](https://opencharacterformat.org/)
pack for Kevin Crawford's _Godbound: A Game of Divine Heroes_ (Sine Nomine Publishing, 2016),
built from its Free Edition. It is for apps that build, show and play its heroes with an OCF
engine: attributes and Facts, the 25 Words of Creation with their gifts, Effort, Influence and
Dominion, hit points, saves, attacks and the damage chart, advancement to 10th level, theurgy, low
magic, gear and artifacts.

It is not affiliated with or endorsed by Sine Nomine Publishing. Its text comes from the Free
Edition, used with the author's permission; nothing comes from the deluxe edition.

## Install and load

```sh
pnpm add @opencharacter/godbound-core @opencharacter/engine
```

The package's default export is the pack's release, ready for `loadRuleset`; its English text is
`@opencharacter/godbound-core/i18n/en` (also as JSON, `release.json` and `i18n/en.json`).

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import divine from '@opencharacter/godbound-core';

const loaded = loadRuleset([divine]);
if (!loaded.ok) throw new Error(loaded.errors.map((e) => e.code).join(', '));
const { ruleset } = loaded;

// A random hero: rolled attributes, three Words, six points of gifts, armor and a weapon.
const blank = {
  specVersion: '0.1.0',
  id: 'hero',
  packs: [{ id: 'godbound-core', version: '0.1.0' }],
  creating: true,
};
const run = startAction(ruleset, blank, {
  action: { id: 'godbound-core:create-character' },
  params: { random: true },
});
if (!('status' in run) || run.status !== 'finished') throw new Error('creation paused');
const made = applyChanges(
  ruleset,
  blank,
  run.proposedChanges.map((p) => p.change),
);
if (!made.ok) throw new Error('creation failed');
computeSheet(ruleset, made.character).values['godbound-core:effort.max']?.value; // 2
```

## License

- **License:** `LicenseRef-sine-nomine-free-edition`. Apps that show this pack's content must
  pass on its `credit` and its notices:

  > Text from Godbound: A Game of Divine Heroes (Free Edition), © 2016 Sine Nomine Publishing,
  > by Kevin Crawford. Used with the author's permission.
  - `permission`: the Free Edition's content is reproduced with its author's permission, and
    deluxe-edition content is excluded.
  - `not-affiliated`: the pack is unofficial and not endorsed by Sine Nomine Publishing.

  [`LICENSE`](LICENSE) says the same. The contributors' own work (the data and the labels that
  aren't the game's text) is CC0 1.0.

- **Text:** the Free Edition's own text is the description of every Word, gift, gift of
  Apotheosis, theurgic invocation and low magic tradition, and of the weapon and armor categories.
  Rules labels (fields, actions, prompts) are written for the pack.

## What's modeled

- **Attributes:** six scores (3–18) with the book's modifiers (19, the Word of Might, is +4) and
  check targets (21 minus the score). A situational `fact` adds +4 to a check.
- **Facts:** origin, past career and relationship, one more per level (`facts.level2` …
  `facts.level10`, shown from that level), and a goal. They are text the player writes.
- **Creation:** two starts running `create-character` on a character being created.
  - `guided`: roll 4d6 drop the lowest six times or take the array 16, 14, 13, 13, 10, 8 (the
    array recommended, 16 in Constitution), assign the scores, bind three Words, optionally a
    fourth for three points, spend the six gift points, then armor, a shield and a weapon. Every
    step recommends a pick, so an automatic run finishes.
  - `random`: the attributes are rolled and recommended in the order rolled; the three Words are
    drawn uniformly; gifts are drawn uniformly among the bound Words' gifts and the universal
    gifts the remaining points afford, until the points are spent; armor (none, light, medium,
    heavy), a shield (or not) and a weapon category are drawn uniformly; Sorcery's invocations are
    drawn.
  - The choices the Words, gifts and armor bring (a Word's raised attribute, Excellence of the
    Word, the saves medium or heavy armor hinders, invocations) are asked at the end, each with a
    recommendation. Hit points start full.
- **Words:** all 25 Words of the Free Edition, each with its gifts, and Apotheosis.
  - Attribute raises are effects (16, or 18 if the score is already 16 or more); where a Word
    offers two attributes, a choice on the Word picks one.
  - Fire's flame is a weapon; Luck's daily d20 is kept in `luck.reserve`, and the `luckReserve`
    situational choice puts it in place of a check's, save's or attack's d20 (emptying the
    reserve); Sorcery negates low magic for a scene's Effort.
  - Apotheosis is every hero's (a standard copy) and grants its gifts by level, unless the hero
    is a free divinity (`apotheosis.free`), who gains Dominion each month instead.
- **Gifts:** each gift's Word, degree, activation (Constant, On Turn, Action, Instant), Smite,
  and how long its Effort stays committed (while active, the scene, or the day).
  - `invoke-gift` commits that Effort; a gift held "while active" keeps it on its copy
    (`committed`) until `release-gift`.
  - Numeric effects are modeled: natural AC 3, +1 Effort, +2 Influence, Excellence's 18, +2 hit
    points per level, +1 monthly Dominion, damage reduction, minimum weapon dice (1d10, 1d12 for
    two-handed, 1d10+1), always-maximum damage and Fray, rerolled 1s.
  - Gifts that are weapons have an `attack`; damaging gifts a `gift-blast` (on the damage chart,
    straight, or against a Mob); healing gifts a `gift-heal`.
  - Gift points: six, plus two per level. A lesser gift of a bound Word costs 1, a greater 2, a
    lesser gift of another Word 2 (1 once that Word is bound), a universal gift 1 (Effort of the
    Word 2 after the first), each Word past three 3. `gifts.points.spent` works it out from the
    sheet; spending past the total is a rules issue.
- **Effort:** 2 plus 1 per level (more from gifts and divine fury). Commitments for the scene and
  the day are counted in `effort.scene` and `effort.day`; `end-scene` and `new-day` return them
  (and, unless kept, the Effort gifts hold). `miracle` commits a day's Effort (two to mimic a gift
  that already commits for the day) and can hurt one target (1d8 per level) or several (1d6 per
  two levels), or give natural AC 3 for the scene.
- **Influence and Dominion:** maximum Influence (2 plus 1 per level, more from gifts) and
  committed Influence; Dominion held and spent; Wealth.
- **Combat:** hit points (8 plus Constitution, then 4 plus half Constitution, rounded up, per
  level), attack bonus (the level), armor class (the better of natural and worn armor, less
  Dexterity, never worse than 9), saves (16 minus level minus the better modifier, plus 4 for each
  save armor hinders), the 1d8 Fray die.
  - `attack` rolls d20 + attack bonus + attribute modifier, a hit when it plus the target's AC
    reaches 20 (natural 20 hits, natural 1 misses). Damage is read on the damage chart die by die,
    with the modifier on the die it helps most, or straight.
  - `saving-throw` and `attribute-check` roll d20 against the target; a failed save may commit a
    day's Effort to succeed.
  - `divine-fury` at zero hit points, once a level: half the hit points back and bonus Effort equal
    to the level until `end-fury`.
- **Advancement:** the experience and Dominion-spent table to level 10; the `level-up` follow-up
  and action add the level, renew divine fury and spend or save the two new gift points (or bind a
  Word for three).
- **Theurgy:** the 33 invocations of the Gate, the Way and the Throne, picked through Adept of the
  Gate (4), the Way (3) and the Throne (2). `cast-invocation` casts slowly, quickly (scene's
  Effort) or instantly (day's Effort and a 1d6, 1d12 or 1d20 damage die of backlash).
- **Low magic:** the eight traditions. Spontaneous casting up to the level per hour's respite,
  less one per two prepared spells; up to two prepared spells per level; the Academy of Thought's
  cumulative penalty (or a 1d6 damage die instead).
- **Gear:** the weapon categories (unarmed always at hand), light, medium and heavy armor (each
  suit's hindered saves chosen on it), shields. Artifacts: a type with an Effort pool, a daily
  bond and `spent` Effort; an artifact's own gifts are grants written on the item.

## Rule readings

- **Random start:** the book has no random method beyond rolling attributes, so Words, gifts and
  gear are drawn uniformly, and the rolled scores are assigned in the order rolled.
- **Damage modifier on several dice:** the attacker's choice of die is the one the modifier helps
  most.
- **Healing gifts on others:** they propose the hit points and the day's Effort to the target.
- **Gifts used from an artifact** still offer `invoke-gift`, which commits the wielder's Effort;
  use the artifact's `draw-artifact-effort` instead.
