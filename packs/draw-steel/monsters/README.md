# Draw Steel Monsters

`@opencharacter/draw-steel-monsters` is an **unofficial** [Open Character Format](https://opencharacterformat.org/)
pack for MCDM's _Draw Steel: Monsters_, an add-on to
[`draw-steel-heroes`](../heroes/README.md). It is for apps that run the Director's side with an
OCF engine: monster sheets made from stat blocks, minion squads, Malice and villain actions, with
every ability used through the heroes pack's `use-ability`.

The Open Character Format Draw Steel Monsters pack (draw-steel-monsters) is an independent product
published under the DRAW STEEL Creator License and is not affiliated with MCDM Productions, LLC.
DRAW STEEL © 2026 MCDM Productions, LLC.

## Install and load

```sh
pnpm add @opencharacter/draw-steel-monsters @opencharacter/draw-steel-heroes @opencharacter/engine
```

This release needs spec 0.4 (`@opencharacter/engine` 0.4.0 or later) and `draw-steel-heroes`
0.1.1 or a later 0.1 release, loaded before it.

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import heroes from '@opencharacter/draw-steel-heroes';
import monsters from '@opencharacter/draw-steel-monsters';

const loaded = loadRuleset([heroes, monsters]);
if (!loaded.ok) throw new Error(loaded.errors.map((e) => e.code).join(', '));
const { ruleset } = loaded;

// A squad of six goblin spinecleavers: one sheet, one Stamina pool.
const blank = {
  specVersion: '0.4.0',
  id: 'spinecleavers',
  packs: [
    { id: 'draw-steel-heroes', version: '0.1.1' },
    { id: 'draw-steel-monsters', version: '0.1.0' },
  ],
  creating: true,
};
const run = startAction(ruleset, blank, {
  action: { id: 'draw-steel-monsters:create-monster' },
  params: { monster: 'draw-steel-monsters:monsters.goblin.goblin-spinecleaver', squad: 6 },
  policy: { dice: 'auto', choices: 'auto', allocations: 'auto' },
});
if (!('status' in run) || run.status !== 'finished') throw new Error('creation paused');
const made = applyChanges(
  ruleset,
  blank,
  run.proposedChanges.map((p) => p.change),
);
if (!made.ok) throw new Error('creation failed');
computeSheet(ruleset, made.character).values['draw-steel-heroes:stamina.max']?.value; // 30
```

## License

- **License:** `LicenseRef-draw-steel-creator-license`. Apps that show this pack's content must
  pass on its `credit` and its `permission` notice.
- **Credit:**

  > The Open Character Format Draw Steel Monsters pack (draw-steel-monsters) is an independent
  > product published under the DRAW STEEL Creator License and is not affiliated with MCDM
  > Productions, LLC. DRAW STEEL © 2026 MCDM Productions, LLC.

- **Notice (`permission`):**

  > The DRAW STEEL text, mechanics and rules in this pack, proper names included, are reused
  > under the DRAW STEEL Creator License (https://mcdm.gg/ds-license). No art, logos or page
  > layouts are included.

[`LICENSE`](LICENSE) says the same.

## What's modeled

- **Monster sheets:** the `monster` start (and a random one) picks a stat block and adds a copy
  of each of its traits and abilities, so a Director can drop or swap one. The stat block's
  numbers (level, size, speed, Stamina, stability, free strike, characteristics, damage
  immunities and weaknesses, movement, End Effect) are its item's fields, each per copy: change
  one monster's Stamina or speed on its copy (`setField`). Organization, role and EV are on the
  sheet; creature keywords are the item's `creature.*` tags.
- **Minions:** a minion's sheet is its squad (`squad` minions, 4 by default): one Stamina pool,
  never winded, and the minions still standing (`monster.alive`). The squad's captain
  (`set-captain`) turns on the stat block's "With Captain" bonus: damage, a bonus or edges on
  strikes, speed, Stamina per minion, ranged distance and forced movement. On the signature
  ability, `extraMinions` adds each other minion's free strike damage to the first target.
- **Abilities:** monster abilities are the heroes pack's abilities with a fixed power roll bonus
  and potencies as values, so `use-ability` rolls, bands each target, deals typed damage and
  lands conditions and forced movement. An ability without a power roll lands its effect on each
  target; one whose targets make a test ("Each target makes a Might test", tagged
  `target-test.<characteristic>`) hands the test off to each target and lands its tier.
- **Free strikes:** `monster-free-strike` deals the stat block's free strike, typed as the
  signature ability; `minions` adds squad members striking together.
- **Malice:** the `director` start makes the Director's sheet, which holds Malice (gained at the
  start of combat and of each round from its heroes and Victories, lost when combat ends), the
  basic Malice features and the group features in play (`use-malice`). Monsters link it
  (`director`): an ability's Malice cost and its "N Malice" option (`malice`) are paid from it,
  and an ability the pool can't cover isn't offered.
- **Villain actions:** each is offered once per encounter, and only while no villain action was
  used this round on the Director's sheet.
- **End Effect:** `end-effect` takes the stat block's unreducible damage to end an effect a
  saving throw ends.
- **Lasting effects** abilities leave (burning, rage, a convocation's immunity, can't stand) are
  effects with their duration, saving throw and rules, ongoing damage included
  (`ongoing-damage`).

## Monsters

Goblins, the werewolf and the elementals so far; the other groups are being converted.

## Limitations

The book's text is on every item. These parts are the table's to apply.

- **Malice features on monsters:** a Malice feature used from the Director's sheet that changes
  a monster or every monster of a group (Brutal Effectiveness, Goblin Mode) is text; the Director
  applies it ([#187](https://github.com/pixelqueue/opencharacter/issues/187)).
- **Positions:** areas, auras, summoned creatures, terrain, line of effect; forced movement is a
  number in the outcome, not a move.
- **Hero free strikes** from the heroes pack's common abilities are listed on monster sheets too;
  a monster's free strike is `monster-free-strike`.
- **"With Captain: +N bonus to melee distance"** is in the text only.
- **Solo turns** and the order of villain actions are the Director's.
