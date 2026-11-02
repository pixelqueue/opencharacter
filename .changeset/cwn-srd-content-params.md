---
'@opencharacter/cwn-srd': minor
---

Weapons and spells declare the parameters they use (`params` effects): `attack` offers `attribute` only on Str/Dex weapons, `thrown` only on melee weapons with a range and `burst` only on burst weapons, and `cast-spell` offers `commit` only on spells that Commit for the scene or the day. Their text moves to `types.weapon.params.*` and `types.spell.params.*`.

Apps pass `attribute`, `thrown`, `burst` and `commit` only where describeAction lists them for that weapon or spell (one passed where describeAction doesn't list it is ignored), and read their names from `types.weapon.params.*` and `types.spell.params.*` instead of the actions' own param keys.
