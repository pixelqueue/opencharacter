---
'@opencharacter/5e-srd-5.2': minor
---

Open to add-on packs: weapon damage type, ammunition and mastery, feat category, gear category and
ammunition, tool, vehicle and magic item category, spell school and damage types, monster type tag
and monster action damage types are open enums, so a dependent pack adds values with
`extendEnums`. Creation and level-up steps carry tags (`creation.class`, `creation.species`,
`creation.trinket`, `creation.finish`, `level-up.class`, `level-up.gain`, …), and the weapon
attack's mastery riders `weapon-mastery.rider`, for an add-on's rules-level options and changes.
