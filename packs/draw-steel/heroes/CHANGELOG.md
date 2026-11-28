# @opencharacter/draw-steel-heroes

## 0.2.0

### Minor Changes

- 418f1ea: draw-steel-heroes: fields and rules a creature pack needs.

  - A kit's damage bonus for a tier adds a part only when it's above 0, so a creature without a kit (or a kit with a 0 tier) no longer gets an untyped 0 adjust when an `op: tag` types the ability's damage.
  - `powerRoll.strikeEdgesAgainstFor`: an edge on strikes for attackers whose `side` or creature ID is in the set (rule `target-side-strike-edge`). `powerRoll.edgesAgainstFor` (`target-side-edge`) now matches the attacker's creature ID too: both hold sides or creature IDs.
  - `powerRoll.meleeStrikeBanesAgainst` and `powerRoll.rangedStrikeBanesAgainst`: banes on melee and on ranged strikes against the creature.
  - A `flying` input field (the player or Director sets it). Wings (devil, dragon knight) give damage weakness 5 while flying at 3rd level or lower.
  - The `creature` view carries `flying` and the new edge and bane fields.
  - `abilities.barred`: keywords (`kw.*` tags) the creature can't use abilities with; `use-ability` isn't available for an ability with one.
  - A `potencyBonus` on a target's own tier (`power-target`) raises the potency against that target.
  - Conditions and effects take the durations `own-next-start` and `own-next-end` (and `own-this-turn`, an own-next-end one in that turn): until the start or the end of the holder's own next turn, ended by `turn-boundary` on that creature's turns whoever applied it, so a frightened, grabbed or taunted creature keeps its source as `appliedBy`. An ability's `t{tier}Duration` takes `own-next-start` and `own-next-end` for the target's next turn.

  No saved shape changes. Conformance cases and the test-only `test-draw-steel-foe` pack show each.

- 2c91d57: draw-steel-heroes: stacking side edges and more of the creature view.

  - `powerRoll.edgesAgainstSide.{side}` and `powerRoll.strikeEdgesAgainstSide.{side}` (a new `side` family: `heroes`, `director`): edges on any ability roll, or on strikes, against the creature for attackers of that side, counted, so each effect that adds 1 is an edge (rules `target-side-edges-{side}`, `target-side-strike-edges-{side}`); the power roll still caps them at a double edge. `powerRoll.edgesAgainstFor` and `powerRoll.strikeEdgesAgainstFor` are unchanged. A pack that adds a side adds it to the `side` family too, and the two rules for it.
  - The `creature` view carries the new side edge fields, `stamina.temp`, `immunity.{damageType}`, `immunity.{damageType}All`, `immunity.all`, `weakness.{damageType}` and `weakness.all`.

  No saved shape changes. Conformance cases and the test-only `test-draw-steel-foe` pack show each.

- f399710: draw-steel-heroes: edges and banes against a creature, more of the target's view, and next-turn tier durations.

  - Edges and banes on ability rolls against a creature, set by effects on it and counted by every ability used against it (`power-target`): `powerRoll.edgesAgainst` (any ability roll), `powerRoll.strikeEdgesAgainst`, `powerRoll.strikeBanesAgainst`, `powerRoll.meleeStrikeEdgesAgainst`, `powerRoll.edgesAgainstFor` (an edge for attackers of the sides listed) and `powerRoll.nextStrikeEdgesAgainst` (the next strike against it, which proposes ending the target's entries tagged `ends.next-strike-against`). They stack with the existing ones; the power roll caps and cancels them as before.
  - A `side` field (`heroes` for a hero, `director` when `sheet.hero` is false; open, and an effect may set it).
  - The `creature` view also carries `stamina.max`, `conditions.grabbedBy`, `effects.active` (the IDs of the `effect` content in effect, a new sheet field), `side` and the new edge and bane fields. Apps that build target views from the whole sheet need no change.
  - An ability's `t{tier}Duration` takes `next-start` and `next-end`: until the start or the end of the user's next turn, ended by `turn-boundary` on the user's turns.
  - An `effect` applied again merges only with the same applier's entry (`reapply` `match: [appliedBy]`), so two creatures' effects end on their own appliers' turns.
  - Look! (Shadow, Harlequin Mask) now distracts its targets: ability rolls against them gain an edge until the start of the shadow's next turn. Two shadows' Look! give one edge (stack key `look-distracted`, highest only) while either lasts.

  No saved shape changes. Conformance cases and the test-only `test-draw-steel-foe` pack show each.

### Patch Changes

- 5a560a8: Healing Grace and Prayer Effect find the conditions they end by `item.id` instead of `self.source`, which an applied entry doesn't have, so standing up and ending an effect no longer fail when applied. The engine's checker now refuses 0.1.1 at load (`unknown-name` on `self.source`): use this release, or load 0.1.1 with the build's checks skipped (`prechecked`).

## 0.1.1

### Patch Changes

- a3fcd4f: Add the `draw-steel-heroes` pack (Draw Steel: Heroes, published under the DRAW STEEL Creator License) to the bundle.
