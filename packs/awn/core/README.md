# Ashes Without Number

`@opencharacter/awn-core` is an unofficial [Open Character Format](https://opencharacterformat.org/)
pack for the character rules of _Ashes Without Number_, by Kevin Crawford (Sine Nomine
Publishing). It is for apps that build, show and advance survivors with an OCF engine: attributes,
backgrounds, skills, edges, foci, mutations, hit points, saves, advancement to 10th level, gear
and encumbrance.

Its text (skill, edge, focus, mutation and background descriptions) comes from the game's free
edition and is used with the author's permission. Nothing from the paid edition is included.

## Install and load

```sh
pnpm add @opencharacter/awn-core @opencharacter/engine
```

```ts
import { applyChanges, loadRuleset, startAction } from '@opencharacter/engine';
import apocalypse from '@opencharacter/awn-core';

const loaded = loadRuleset([apocalypse]);
if (!loaded.ok) throw new Error(loaded.errors.map((e) => e.code).join(', '));
const { ruleset } = loaded;

// A random survivor: every roll and pick made by the engine.
const blank = {
  specVersion: '0.1.0',
  id: 'survivor',
  packs: [{ id: 'awn-core', version: '0.1.0' }],
  creating: true,
};
const run = startAction(ruleset, blank, {
  action: { id: 'awn-core:create-character' },
  params: { random: true },
  policy: { dice: 'auto', choices: 'auto', allocations: 'auto' },
});
```

## License

- **License:** `LicenseRef-sine-nomine-free-edition`. The free edition's text is reproduced with
  the author's permission; apps that show the pack's content must pass on its `credit` and
  notices:

  > Text from Ashes Without Number (Free Edition), © 2025 Sine Nomine Publishing, Inc., by Kevin
  > Crawford. Used with the author's permission.

- **Notices:** `permission` (the free edition's content is used with permission; the paid
  edition's is excluded) and `not-affiliated` (the pack is unofficial and not endorsed by Sine
  Nomine Publishing). [`LICENSE`](LICENSE) has them all.

## What's modeled

- **Attributes:** the six scores (3–18) and their modifiers. Bonuses "to a maximum of +2"
  (`attributes.*.boost`), uncapped bonuses and penalties (never below −2) are kept apart, so
  every edge, focus and mutation applies the book's caps.
- **Skills:** the 19 skills at level −1 (untrained) to 4. A skill check rolls 2d6 (more dice,
  best two kept, with Specialist and Healer) plus an attribute modifier and the level.
- **Creation** (`create-character`), in the book's order: attributes (3d6 in order and a 14, or
  the array), background (d20), its free skill, two picks or three Growth/Learning rolls, the
  underdog rule, two edges, mutations, foci, the edges', foci's and mutations' own picks, the free
  bonus skill, hit points and starting equipment (hapless innocents, you saw it coming, or a
  wasteland warrior with the near-future or wasteland table).
  - `guided` recommends the quick skills, the lowest roll for the 14 and the first option
    elsewhere; `random` rolls every table and draws every free pick.
  - A skill pick past level-1, or a skill a negative mutation forbids, goes to another skill.
- **Edges, foci and bonus skills:** each edge and focus is a copy (a focus with its level, 1 or
  2). Their bonus skills are applied by the action that adds them: a skill pick at creation,
  three skill points (kept as credit) later. Edges and foci the level earns are follow-ups.
- **Mutations:** mutation points from Mutant, Mutation Acceleration and up to three rolled
  negative mutations (d100, with Lightly Touched); the stigma (concealable for a point, and the
  suggestion tables); positive mutations rolled (d6 + d10), rolled two in a category, or picked.
  Negative mutations' attribute penalties, forbidden skills and barred sensory mutations apply;
  Slow Development's favorite skill is a choice on it, and every other skill's `cap` is one
  below the level's usual maximum (at least level-0).
- **Hit points, attack bonus and saves:** by level, with Hard to Kill, On Target and the
  mutations that change them. `level-up` rerolls hit points (the roll if better, else +1).
- **Advancement:** experience on the fast or slow table, `level-up`, `improve-skill` and
  `improve-attribute` with the book's costs and minimum levels.
- **Gear:** armor, ranged, melee, high-tech and portable heavy weapons, survival gear, drugs and
  stims. Each weapon shows its hit bonus, damage bonus and Shock; `attack` rolls it.
- **Encumbrance:** Readied (equipped) and Stowed loads against Strength, small items bundled
  three to one when stowed, and the slower moves of pushing past the limits.
- **System strain and stress:** maximums with the edges, foci and mutations that change them.

## Rule readings

- **Learning picks** may take any skill: every Learning table ends with Any Skill.
- **Random start:** one Growth and two Learning rolls (the book's example), a d4 for zero to three
  negative mutations, and every mutation point on single rolls.
- **Rerolls** of a duplicate or barred mutation are a uniform draw among the ones still open,
  which is what rerolling until one fits gives.
- **An edge's bonus skill after creation** (Mutant or another at 5th level) counts as three skill
  points, as a focus's does.
- **Stigma details:** the d12 column follows the nature (texture for size, amorphous and
  mineral changes).

## Not modeled

Vehicles, mods, the high-tech loot tables (a placeholder item stands for them), psychic scars,
traumatic hits beyond the trauma target, and the many once-per-scene or narrative powers, which
are text only.
