---
'@opencharacter/cwn-srd': patch
---

Weapons and spells declare the parameters they use (`params` effects): `attack` offers `attribute` only on Str/Dex weapons, `thrown` only on melee weapons with a range and `burst` only on burst weapons, and `cast-spell` offers `commit` only on spells that Commit for the scene or the day. Their text moves to `types.weapon.params.*` and `types.spell.params.*`.
