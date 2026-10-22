# Stars Without Number: Revised Edition

`@opencharacter/swn-revised` is an unofficial [Open Character Format](https://opencharacterformat.org/)
pack for the character rules of _Stars Without Number: Revised Edition_ by Kevin Crawford (Sine
Nomine Publishing), built from the game's free edition. It is for apps that build, show and play
its characters with an OCF engine: attributes, backgrounds, skills, the four classes and the
partial classes, foci, psionics, advancement to 10th level and beyond, saving throws, combat,
System Strain, and the free edition's armor, weapons, gear and cyberware.

It is not affiliated with or endorsed by Sine Nomine Publishing. Its text comes from the free
edition only, with the author's permission; nothing from the paid deluxe edition is included.

## Install and load

```sh
pnpm add @opencharacter/swn-revised @opencharacter/engine
```

The package's default export is the pack's release, ready for `loadRuleset`; its English text is
`@opencharacter/swn-revised/i18n/en` (also as JSON, `release.json` and `i18n/en.json`).

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import scifi from '@opencharacter/swn-revised';

const loaded = loadRuleset([scifi]);
if (!loaded.ok) throw new Error(loaded.errors.map((e) => e.code).join(', '));
const { ruleset } = loaded;

// A random character from the quick creation tables: every table is rolled.
const blank = {
  specVersion: '0.1.0',
  id: 'basil',
  packs: [{ id: 'swn-revised', version: '0.1.0' }],
  creating: true,
};
const run = startAction(ruleset, blank, {
  action: { id: 'swn-revised:quick-character' },
  params: { random: true },
  policy: { dice: 'auto', choices: 'auto', allocations: 'auto' },
});
if (!('status' in run) || run.status !== 'finished') throw new Error('creation paused');
const made = applyChanges(
  ruleset,
  blank,
  run.proposedChanges.map((p) => p.change),
);
if (!made.ok) throw new Error('creation failed');

const sheet = computeSheet(ruleset, made.character);
sheet.values['swn-revised:saves.physical']?.value; // 15 less the better of Str and Con modifiers
```

## License

- **License:** `LicenseRef-sine-nomine-free-edition`. The free edition's text is used with the
  author's permission, and apps that show this pack's content pass on its `credit`:

  > Text from Stars Without Number: Revised Edition (Free Edition), © 2017 Sine Nomine
  > Publishing, Inc., by Kevin Crawford. Used with the author's permission.

- **Notices:** `permission` (the free edition's content is reproduced with the author's
  permission; nothing from the paid edition is included) and `not-affiliated`.
- [`LICENSE`](LICENSE) gives the terms. The contributors' own work in the pack (its data, and
  the names and labels written for it) is under CC0 1.0; the free edition's text and names
  belong to Sine Nomine Publishing.
- **Text:** names and labels are in `i18n/en.yaml` and `i18n/en/`. Descriptions are the free
  edition's own text: the skills, backgrounds, classes and partial classes, every focus and
  every psionic technique.

## What's modeled

- **Attributes:** the six scores (3–18) and their modifiers (−2 to +2).
- **Skills:** the 19 skills and the six psychic disciplines, each a level from −1 (untrained) to 4. `skill-check` rolls 2d6 + skill + an attribute modifier against a difficulty; untrained is
  −1. Foci that roll 3d6 or 4d6 and keep the best two raise the skill's `dice`.
- **Saving throws:** Physical, Evasion and Mental, 16 less the level less the better of two
  modifiers. `saving-throw` succeeds on a d20 at or over it; a natural 1 always fails and a
  natural 20 always succeeds.
- **Creation:** three starts.
  - `standard`, the full procedure: roll 3d6 in order (and set one score to 14) or assign 14,
    12, 11, 10, 9, 7; a background and its free skill; the quick skills, two picks from the
    Learning table, or three rolls split between the Growth and Learning tables; a class (an
    Adventurer picks two partial classes); a Psychic's two disciplines or a Partial Psychic's
    one; one focus level, plus the Expert's non-combat and the Warrior's combat one; a hobby
    skill; hit points; an equipment package or 2d6 × 100 credits.
  - `quick` and `random`, the quick creation tables: class and style (d8), background (d20),
    two disciplines for a psychic (d6), foci from the style's row (d6) and a bonus skill (d20).
    `random` rolls every table, so an automatic run finishes the character; the equipment
    package is drawn among the ten packages and the credits roll.
  - Every skill pick follows the book: a skill's first pick is level-0, the second level-1,
    and a third is any other non-psychic skill below level-1. A psychic skill raised to level-1
    brings a free level-1 technique.
- **Classes:** Expert (a non-combat focus, a reroll of a failed skill check once a scene, a
  bonus non-combat skill point each level), Psychic (unrestricted psionics, Effort), Warrior (a
  combat focus, +2 hit points a level, attack bonus equal to the level, once-a-scene luck on
  attacks) and Adventurer, with two of Partial Expert, Partial Psychic (one discipline) and
  Partial Warrior (+1 attack bonus at 1st and 5th level).
- **Foci:** all 25 of the free edition, each with its bonus skill; their mechanical benefits are
  modeled where the sheet can show them (Ironhide's AC, Die Hard's hit points, Specialist's,
  Healer's, Hacker's and Sniper's dice, Armsman's and Gunslinger's damage, Unarmed Combatant's
  fists, Shocking Assault's Shock, Psychic Training's Effort, Wild Psychic Talent).
- **Psionics:** the six disciplines, their core techniques (held while the skill is level-0 or
  better) and 63 techniques, each needing its skill level. Effort is 1 + the highest psychic
  skill + the better of Wisdom and Constitution modifiers (at least 1); `commit-effort` commits
  it for the scene or the day, `sustain-technique` commits a point to a technique for as long as
  it lasts (held on the technique's copy, the pick of a Wild Psychic Talent, or the grant of a
  core technique, until `release-technique` reclaims it), and `torch`
  rolls the torching table for a free point.
- **Advancement:** the experience table (a `level-up` follow-up to 10th level; later levels are
  the GM's call). `level-up` rolls the hit dice, grants three skill points (one psychic for a
  psychic, plus the Expert's), and a focus level at 2nd, 5th, 7th and 10th. `raise-skill`,
  `learn-technique` and `boost-attribute` spend the points at the book's costs and level limits.
  A focus's bonus skill taken on advancement is three points toward that skill; what doesn't buy
  a level is saved as the skill's `credit`, which `raise-skill` spends first.
- **Combat:** attack bonus, `attack` (d20 + attack bonus + combat skill, −2 untrained, +
  modifier, +1 for energy weapons, +2 for burst fire) against the target's AC, damage, Shock on
  a miss, ammunition and `reload`; Armor Class from the best armor, a shield and Dexterity.
- **System Strain:** permanent from cyberware, temporary from drugs; `use-drug` and
  `trigger-cyberware` refuse what would pass Constitution. `rest` restores hit points, Strain,
  Effort and the once-a-scene abilities.
- **Encumbrance:** Readied (equipped) items up to half Strength, Stowed up to Strength, and the
  lightly and heavily encumbered bands.
- **Equipment:** every armor, ranged, melee and heavy weapon, general equipment and
  pharmaceutical, and cyberware item of the free edition, with the equipment packages.

Starships, vehicles, drones and gear mods are not modeled.
