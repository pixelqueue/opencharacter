---
'@opencharacter/cwn-srd': patch
---

Spells count their casts in the scene (`sceneCasts` state, reset by `end-scene` and `rest`): Blast adds one System Strain after its first cast in a scene, Blastwave one on every cast, and a second Stun in a scene Commits Effort for the day. `cast-spell` has new tagged steps `spell.effort` and `spell.cast` for such costs.
