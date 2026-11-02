---
'@opencharacter/5e-srd-5.1': patch
'@opencharacter/spec': patch
---

Spell cards carry the character's numbers: the spell type has computed values `castingClass`, `spellDc`, `spellAttack` and `spellMod` (in computeSheet's `activationValues`), worked out as `cast-spell` does (a stored spell's own numbers, a magic item's own DC and attack bonus, else the class's), and the spell block ends with "Save DC 14" or "Spell attack +6". `cast-spell` reads them instead of recomputing; a spell on no class's list now casts with the character's highest DC and attack bonus rather than 0. Conformance suite: `sheets/5e-spell-card-values`.

The draconic ancestry carries its breath weapon's save DC and dice as computed values (`breathDc`, `breathDice`), which `breath-weapon` reads.
