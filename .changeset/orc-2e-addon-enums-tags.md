---
'@opencharacter/orc-2e': minor
---

Open to add-on packs: the subclass identity fields (`barbarian.instinct`, `bard.muse`,
`oracle.mystery`, …), weapon and armor groups, weapon, consumable, spell, affliction and
persistent damage types, consumable and feat categories are open enums, so a dependent pack adds
values with `extendEnums`. Each barbarian instinct sets `barbarian.instinct` itself, so an added
instinct sets its own. A choice of any skill offers `skills.offered`, and one of any Lore
`skills.lores`, which an add-on's Lore joins with a rules effect; their options now come in
alphabetical order. Creation and level-up steps carry tags (`creation.ancestry`,
`creation.heritage`, `creation.background`, `creation.class`, `creation.finish`, `level-up.gain`)
for an add-on's rules-level options and changes.
