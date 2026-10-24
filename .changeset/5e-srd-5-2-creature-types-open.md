---
'@opencharacter/5e-srd-5.2': minor
---

Open to add-on packs: creature types (`creature.type`, a monster's `creatureType`, a condition's
`by` and the slaying ammunition's `slays`) are open enums, and an attack's target view follows
the open `creature.type`, so an add-on's creature type is created, attacked and slain as the
core's are. The damage type parameters of `spell-effect`, `item-power` and `throw-item` are open too.
