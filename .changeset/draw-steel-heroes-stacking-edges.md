---
'@opencharacter/draw-steel-heroes': minor
'@opencharacter/spec': patch
---

draw-steel-heroes: stacking side edges and more of the creature view.

- `powerRoll.edgesAgainstFor` and `powerRoll.strikeEdgesAgainstFor` give one edge per entry that names the attacker's `side` or creature ID, plain (`director`) or qualified with `@` (`director@<anything>`), so effects that each grant a qualified entry (`'director@' + self.id`) stack; the power roll still caps them at a double edge. A plain entry granted twice is still one edge.
- The `creature` view carries `stamina.temp`, `immunity.{damageType}`, `immunity.{damageType}All`, `immunity.all`, `weakness.{damageType}` and `weakness.all`.

No saved shape changes. Conformance cases and the test-only `test-draw-steel-foe` pack show each.
