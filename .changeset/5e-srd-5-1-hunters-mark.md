---
'@opencharacter/5e-srd-5.1': patch
'@opencharacter/spec': patch
---

Hunter's Mark is modeled, as in 5.2: casting it applies the spell to the target, the target's `huntersMark.markedBy` lists who marked it (each applied spell's `appliedBy`; also in the `target` view), and the caster's weapon damage against a creature it marked adds 1d6 of the weapon's type. Its `move` action ends the caster's mark wherever it is (`removeEffect` `to: applied`) and marks a new creature. Conformance suite: `5e-hunters-mark-move` and `5e-hunters-mark-marked-by`.

Hunter's Mark's `move` is offered only while the caster concentrates, and the new target's entry keeps the slot the spell was cast with (the optional `slot` parameter, else 1st) as `castSlot`.
