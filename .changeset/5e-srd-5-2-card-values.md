---
'@opencharacter/5e-srd-5.2': patch
'@opencharacter/spec': patch
---

Spells carry the character's numbers: the spell type has computed values `castingClass`, `spellDc`, `spellAttack` and `spellMod` (in computeSheet's `activationValues`), worked out as `cast-spell` does (a stored spell's own numbers, a magic item's own DC and attack bonus, else the spellcasting's, else the character's highest). `cast-spell`, `spell-effect` and the actions of Moonbeam, Flaming Sphere, Ice Knife, Insect Plague, Glyph of Warding, Flame Blade, Guardian of Faith, Faithful Hound and Incendiary Cloud read them instead of recomputing; a spell on no list (Gift of the Depths' Water Breathing) now casts with the character's highest DC rather than 0, and a stored spell's later turns use its stored DC. Conformance suite: `sheets/5e52-spell-card-values`.

Features carry their card numbers as computed values, which their actions read: Breath Weapon's `breathDc` and `breathDice`, Cunning Strike's `strikeDc`, Intimidating Presence's `presenceDc`, Relentless Rage's `rageDc`, Sacred Weapon's `weaponBonus` and Preserve Life's `healingPool`. Conformance suite: `actions/5e52-breath-weapon`.
