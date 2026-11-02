---
'@opencharacter/5e-srd-5.2': patch
'@opencharacter/spec': patch
---

Sap, Slow and Vex (and Studied Attacks' Vex) read who applied them from the entry's `appliedBy`, which every attack now records, instead of the `attacker` state the attack wrote; `attacker` stays declared and is still read for entries saved without an applier. A new rules action, `turn-boundary` (`clock: turn-boundary`), which the app runs on every creature at each turn change, ends Sap and Slow when their applier's next turn starts, and Vex when that turn ends (a new `armed` state on combat effects, default false, marks that the turn has started). Conformance suite: `5e52-turn-boundary` and `5e52-turn-boundary-ends`; `5e52-attack-vexed-target-advantage` expects the applier-reading query.

Hex and Hunter's Mark: `hex.cursedBy` and `huntersMark.markedBy` name each applied spell's `appliedBy` (the `caster` state is no longer written, and is still read for entries saved without an applier), and each spell has a `move` action that ends the caster's curse or mark wherever it is (`removeEffect` `to: applied`) and puts it on the new target (Hex asks its ability again). Conformance suite: `5e52-hex-move` and `5e52-hex-cursed-by`; `5e52-cast-enhance-ability-per-target` no longer expects `caster` on the applied spell.

When concentration ends, the new required follow-up `concentration-ends` ends the caster's concentration spells on every creature holding one (`removeEffect` `to: applied`, by the entries' `appliedBy`; entries saved without an applier stay the app's). Conformance suite: `5e52-concentration-ends`.

effects.md: the Vexed example reads the entry's `appliedBy`.

Hex's and Hunter's Mark's `move` is offered only while the caster concentrates, and the new target's entry keeps the slot the spell was cast with (the optional `slot` parameter, else the spell's level) and the caster's spell save DC (`castSlot`, `castDc`).
