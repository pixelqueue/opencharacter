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

This release needs spec 0.3: `@opencharacter/engine` 0.3.0 or later. An engine for an older
spec refuses it (`spec-version-unsupported`).

```ts
import { applyChanges, loadRuleset, startAction } from '@opencharacter/engine';
import apocalypse from '@opencharacter/awn-core';

const loaded = loadRuleset([apocalypse]);
if (!loaded.ok) throw new Error(loaded.errors.map((e) => e.code).join(', '));
const { ruleset } = loaded;

// A random survivor: every roll and pick made by the engine.
const blank = {
  specVersion: '0.2.0',
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
  three to one when stowed, and the slower moves of pushing past the limits. A start that brings
  more than its Strength can haul stows Readied items, then leaves Stowed ones behind, heaviest
  first, until it is within the limits. A guided player picks which, but can't stop early.
- **Rolled twice:** Weak Heart's Exert checks keep the worse of two 2d6 rolls; Constant
  Secretions (the `grapple` situational choice) and Survivalist (`foraging`) keep the better. An
  attack given its target's view (`participants.target`) rolls laser damage twice against Light
  Sensitivity, the higher kept.
- **System strain and stress:** maximums with the edges, foci and mutations that change them.

## Add-on packs

A pack that depends on `awn-core` can add content of its types, and creation and advancement offer
it with the core's, in the guided picks and the random draws:

- **Edges and foci** join every pick. Their limits are tags, not IDs: `repeatable`, `first-edge`
  (Forged By Fire), `needs-mutant`, `makes-mutant`, `not-mutant`, `not-underdog`. One with
  `gainPart: true` runs its own `gain-part` action (`listed: false`) when taken, as Educated,
  Mutant, Mutation Acceleration and Unstable Mutant do; an edge's mutation points are an effect on
  `mutations.points.edges`.
- **Prepared survivors' picks** are content of the type `prepared`: the item (`gear`, by ID;
  another pack's qualified), its quantity, readied or not, and what comes with it (`extra`).
- **Weapons:** a wasteland warrior's weapon is any primitive melee weapon, or a primitive one with
  `kitAmmo` (the bow and its arrows), which comes with that ammunition.
- **Mutations** join the chosen and the fallback picks; the d6 category and d10 tables, and the
  d100 negative table, keep the book's odds.
- **Mutation categories** are content of the type `mutationCategory`, which a mutation names in
  `category`. An added category joins the "two in one category" pick; its mutations' `roll` is
  their d10 roll within it.
- **Tagged steps** take an add-on's rules-level `option` and `changes` effects: `creation.kit`
  (the starting equipment option: an added option is another way to equip), `creation.mutation`
  (how mutation points are spent), `creation.finish` (the last step of creation) and
  `advancement.level` (each new level's level and skill points).

- **Open enums:** the stigma fields (`stigma.part`, `stigma.part2`, `stigma.nature`,
  `stigma.detail`), for more suggestions to set by hand; the rolled tables keep the book's.
- **Naming what an add-on adds:** it names each added value, option or key in its own text,
  under the key this pack would use, and `createText` finds it there when the app passes the
  ruleset's `enumOrigins`, `optionOrigins` and `familyOrigins`. For example,
  `tail` added to `awn-core:fields.stigma.part` is
  `fields.stigma.part.values.tail.name: Tail` (through `enumOrigins`).

- **Skills** are the `skill` family: an add-on adds one (`families: { 'awn-core:skill': [<key>] }`)
  and declares its `skills.<key>.level` (tagged `skill` and `skill.<key>`), `.credit` and `.cap`
  (tagged `skill-cap` and `skill.<key>`). The core's changes reach them through `fieldId`, so
  creation, `improve-skill`, skill points and a forbidding mutation gain, raise and lower it as the
  core's. A background's entries (`freeSkill`, `quickSkill1`, `quickSkill2`, `growth1`–`growth6`,
  `learning1`–`learning8`) and the parameters `improve-skill.skill` and `gain-benefit.entry` are
  open enums that take its key.

The near-future and wasteland d20 tables are the book's own tables.

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
are text only. Low Resistances (the day's first Physical, Mental or Evasion save rolled twice)
is text only too: a roll effect can't end itself once it applies
([#68](https://github.com/pixelqueue/opencharacter/issues/68)).
