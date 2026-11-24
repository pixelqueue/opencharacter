---
'@opencharacter/draw-steel-heroes': minor
'@opencharacter/spec': patch
---

draw-steel-heroes: edges and banes against a creature, more of the target's view, and next-turn tier durations.

- Edges and banes on ability rolls against a creature, set by effects on it and counted by every ability used against it (`power-target`): `powerRoll.edgesAgainst` (any ability roll), `powerRoll.strikeEdgesAgainst`, `powerRoll.strikeBanesAgainst`, `powerRoll.meleeStrikeEdgesAgainst`, `powerRoll.edgesAgainstFor` (an edge for attackers of the sides listed) and `powerRoll.nextStrikeEdgesAgainst` (the next strike against it, which proposes ending the target's entries tagged `ends.next-strike-against`). They stack with the existing ones; the power roll caps and cancels them as before.
- A `side` field (`heroes` for a hero, `director` when `sheet.hero` is false; open, and an effect may set it).
- The `creature` view also carries `stamina.max`, `conditions.grabbedBy`, `effects.active` (the IDs of the `effect` content in effect, a new sheet field), `side` and the new edge and bane fields. Apps that build target views from the whole sheet need no change.
- An ability's `t{tier}Duration` takes `next-start` and `next-end`: until the start or the end of the user's next turn, ended by `turn-boundary` on the user's turns.
- Look! (Shadow, Harlequin Mask) now distracts its targets: ability rolls against them gain an edge until the start of the shadow's next turn.

No saved shape changes. Conformance cases and the test-only `test-draw-steel-foe` pack show each.
