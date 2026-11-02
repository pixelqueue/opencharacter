---
'@opencharacter/5e-srd-5.2': minor
---

A monster's AC, senses, XP and Legendary Action uses are copied onto its sheet, so the whole stat
block is a snapshot (#216). `create-monster` sets them as inputs: `combat.printedAc` (a new field;
it competes with worn armor and Mage Armor as any AC does), `senses.darkvision`,
`senses.blindsight`, `senses.tremorsense`, `senses.truesight`, `senses.telepathy`, `challenge.xp`
and `legendary.actions`, which were derived, and the new `challenge.xpLair` and
`legendary.actionsLair`, which replace them while `legendary.inLair`. The `monster` item no longer
sets them. Effects from traits, spells and items still apply on top. Upgrading from 0.3.0 saves a
monster's values from its stat block; other characters get 0.
