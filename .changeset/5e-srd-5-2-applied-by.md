---
'@opencharacter/5e-srd-5.2': patch
'@opencharacter/spec': patch
---

Sap, Slow and Vex (and Studied Attacks' Vex) read who applied them from the entry's `appliedBy`, which every attack now records, instead of the `attacker` state the attack wrote; `attacker` stays declared and is still read for entries saved without an applier. A new rules action, `turn-boundary` (`clock: turn-boundary`), which the app runs on every creature at each turn change, ends Sap and Slow when their applier's next turn starts, and Vex when that turn ends (a new `armed` state on combat effects, default false, marks that the turn has started). Conformance suite: `5e52-turn-boundary` and `5e52-turn-boundary-ends`; `5e52-attack-vexed-target-advantage` expects the applier-reading query.
