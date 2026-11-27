---
'@opencharacter/draw-steel-heroes': minor
'@opencharacter/spec': patch
---

draw-steel-heroes: stacking side edges and more of the creature view.

- `powerRoll.edgesAgainstSide.{side}` and `powerRoll.strikeEdgesAgainstSide.{side}` (a new `side` family: `heroes`, `director`): edges on any ability roll, or on strikes, against the creature for attackers of that side, counted, so each effect that adds 1 is an edge (rules `target-side-edges-{side}`, `target-side-strike-edges-{side}`); the power roll still caps them at a double edge. `powerRoll.edgesAgainstFor` and `powerRoll.strikeEdgesAgainstFor` are unchanged. A pack that adds a side adds it to the `side` family too, and the two rules for it.
- The `creature` view carries the new side edge fields, `stamina.temp`, `immunity.{damageType}`, `immunity.{damageType}All`, `immunity.all`, `weakness.{damageType}` and `weakness.all`.

No saved shape changes. Conformance cases and the test-only `test-draw-steel-foe` pack show each.
