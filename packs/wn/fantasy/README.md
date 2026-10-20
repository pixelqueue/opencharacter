# Fantasy rules (CC0 SRD)

`@opencharacter/wn-fantasy` is an [Open Character Format](https://opencharacterformat.org/) pack
for the character rules of the Worlds Without Number System Reference Document, which Kevin
Crawford and Sine Nomine Publishing dedicate to the public domain under CC0. It is for apps that
build, show and play these characters with an OCF engine: attributes, backgrounds, skills, the
classes and the Adventurer's partial classes, Foci, hit points, attack bonus and saves,
advancement to tenth level, spells and arts with their Effort, weapons, armor, gear and
encumbrance.

The pack is compatible with Worlds Without Number, but it is unofficial: not an official Sine
Nomine Publishing product, and not affiliated with, licensed by or endorsed by Sine Nomine
Publishing.

## Install and load

```sh
pnpm add @opencharacter/wn-fantasy @opencharacter/engine
```

The package's default export is the pack's release, ready for `loadRuleset`; its English text is
`@opencharacter/wn-fantasy/i18n/en`.

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import fantasy from '@opencharacter/wn-fantasy';

const loaded = loadRuleset([fantasy]);
if (!loaded.ok) throw new Error(loaded.errors.map((e) => e.code).join(', '));
const { ruleset } = loaded;

// A random character: attributes, background and its skills rolled, every other pick drawn.
const blank = {
  specVersion: '0.1.0',
  id: 'new',
  packs: [{ id: 'wn-fantasy', version: '0.1.0' }],
  creating: true,
};
const run = startAction(ruleset, blank, {
  action: { id: 'wn-fantasy:create-character' },
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
computeSheet(ruleset, made.character).values['wn-fantasy:saves.physical']?.value; // 15 or so
```

## What's modeled

- **Attributes:** 3d6 in order with one score raised to 14, or the array 14, 12, 11, 10, 9, 7.
  Modifiers from the score, with Focus bonuses capped at +2 (+3 where a Focus says so).
- **Skills:** the 21 skills, -1 (untrained) to 4. `skill-check` rolls 2d6 (kept highest two, so
  a Specialist's or a Gifted Chirurgeon's extra dice drop the lowest) plus the skill and an
  attribute modifier against a difficulty. No new character has a skill above level-1.
- **Backgrounds:** the SRD's two, Artisan and Barbarian, each with its free skill and Growth and
  Learning tables. A table's own backgrounds are homebrew content of the same type.
- **Classes:** Warrior (Killing Blow), Expert (Quick Learner's extra skill point), Mage (High
  Mage, Elementalist, Necromancer or Invoker), and the Adventurer with two partial classes:
  partial Warrior, Expert or Mage, or the partial-only Accursed, Bard, Beastmaster, Blood Priest,
  Duelist, Healer, Mageslayer, Skinshifter, Thought Noble, Vowed and Wise. The pairing sets the
  hit die (1d6+2, 1d6 or 1d6-1; the Duelist's fragility, Martial Style) and the attack bonus
  table. A Mageslayer pairs with no Mage class; a partial Invoker with no other partial caster.
- **Foci:** all thirty-six, Traditional Education included, with their levels, bonus skills,
  who may take them, and the effects that change numbers: Die Hard, Impervious Defense,
  Developed Attribute, Armsmaster, Deadeye, Shocking Assault, Close Combatant, Unarmed Combatant,
  Specialist, Gifted Chirurgeon, Polymath, Alert, Armored Magic, Xenoblooded.
- **Hit points, attack and saves:** hit dice rolled again each level (no die below 1, one more
  than before at least), the class mix's attack bonus, saves of 16 less level and the better
  modifier, System Strain up to Constitution, Frail and Mortally Wounded.
- **Combat:** `attack` on each weapon: 1d20 plus attack bonus, skill (-2 without it) and the
  better attribute; damage on a hit, Shock on a melee miss against a target with an AC no
  better than the weapon's, and a hit never doing less than its Shock. Armor Class from armor,
  shields (+1 over armor as good) and the natural defenses some Foci and arts give. `initiative`.
- **Magic:** spells by level and list (High Magic, Elementalist, Necromancer), preparation and
  casting limits for full, partial, dual partial and Invoker casters (spell points), the arts
  of every class with the Effort they commit, each class's own Effort pool, and the arts its
  class grants or teaches by level. `cast-spell`, `commit-effort`, `rest` and `end-scene`.
- **Advancement:** experience on the fast or slow track, `level-up` (hit points, skill points,
  a Focus at 2, 5, 7 and 10 with three skill points toward its skill, arts and spells), and
  `improve` to spend skill points on skills and attribute boosts at their level minimums.
- **Gear:** the SRD's weapons, armor, adventuring gear, gear bundles and beasts, with
  encumbrance in Readied and Stowed items, bundles, worn clothing, coins and movement.
- **Creation:** two starts running `create-character`, in the book's order.
  - `random`: attributes and three rolls split between Growth and Learning are rolled; the
    background, class, partial classes, Foci, arts, spells and equipment package are drawn
    evenly among the options open, so an automatic run finishes.
  - `guided`: the player picks, each pick recommended.

## Left to the app or the table

- **Text effects.** Most arts, Foci and spells change no number on the sheet; their names are
  here and their use is the table's. Those that commit Effort do so with `commit-effort`.
- **Situations.** Execution attacks, dual-wielding, screening, the Skinshifter's forms (their
  form bonus and form arts), a Beastmaster's companion's sheet, a Wise's art progression by
  level, and the GM-defined Foci (Special Origin, Unique Gift).
- **Languages, goals and ties.**

## Sources

The Worlds Without Number SRD v1.0 (CC0). The starting equipment packages follow the free
edition of Worlds Without Number, as mechanics only.
