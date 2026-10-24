---
'@opencharacter/orc-sf-2e': minor
---

Open to add-on packs: `mystic.connection` and `witchwarper.paradox`, weapon groups, damage types
and ammunition kinds, armor groups, consumable, spell, affliction and persistent damage types,
consumable and feat categories are open enums, so a dependent pack adds values with
`extendEnums`. A choice of any skill offers `skills.offered`, and one of any Lore `skills.lores`,
which an add-on's Lore joins with a rules effect; their options now come in alphabetical order,
and Skill Training no longer offers Pathfinder Lores this pack doesn't have. New, Syncretic and
Realized Epiphany read `mystic.otherExpertConnections`, `mystic.otherMasterEpiphanies` and
`mystic.connectionRank`, which an added connection adds to. Creation and level-up steps carry
tags (`creation.ancestry`, `creation.class`, `creation.finish`, `level-up.gain`, …) for an
add-on's rules-level options and changes.
