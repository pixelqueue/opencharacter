---
'@opencharacter/5e-srd-5.1': minor
---

Open to add-on packs: weapon damage type and ammunition, gear category and ammunition, tool,
vehicle and magic item category, spell school and damage types, monster subtype and monster action damage
types are open enums, so a dependent pack adds values with `extendEnums`. Creation and level-up steps carry
tags (`creation.race`, `creation.class`, `creation.method`, `creation.finish`, `level-up.class`,
`level-up.gain`, …) for an add-on's rules-level options and changes. An Efficient Quiver's javelin
compartment counts weapons tagged `quiver.javelin`, not the javelin by ID.
