---
'@opencharacter/wwn-srd': patch
---

Weapon cards show their numbers: each weapon copy has computed values for its hit bonus, damage bonus, Shock damage, the AC its Shock reaches and whether it ignores AC, as `attack` rolls them when the weapon is wielded. Armsmaster's and Deadeye's bonuses move from roll effects to new fields by use (`attack.<mode>.bonus` and `damage.<mode>.bonus` for melee, thrown, ranged and unarmed, `shock.melee.bonus`, `shock.unarmed.bonus`), which `attack` adds as parts, so the cards count them; the `skill-damage` stack key still keeps the better of the two on a thrown weapon.
