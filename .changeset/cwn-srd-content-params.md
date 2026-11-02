---
'@opencharacter/cwn-srd': patch
---

Weapons and spells declare the parameters they use (`params` effects): `attack` offers `attribute` only on Str/Dex weapons, `thrown` only on melee weapons with a range and `burst` only on burst weapons, and `cast-spell` offers `commit` only on spells that Commit for the scene or the day. They reach only this pack's actions, through the new action tags `attack.weapon` and `spell.casting`, so another pack's attack that declares `thrown` or `attribute` loads beside it. Their text moves to `types.weapon.params.*` and `types.spell.params.*`.
