---
'@opencharacter/5e-srd-5.1': minor
---

A monster's AC, senses, XP and legendary action count are copied onto its sheet too, so the
whole stat block is a snapshot (#216). `create-monster` sets them as inputs: `combat.printedAc`
(a new field; it competes with worn armor and Mage Armor as any AC does), `senses.darkvision`,
`senses.blindsight`, `senses.tremorsense`, `senses.truesight`, `senses.telepathy`, `challenge.xp`
and `legendary.actions`, which were derived. The `monster` item no longer sets them. Effects
(Darkvision, Devil's Sight, goggles, lycanthrope forms) still apply on top. Upgrading from 0.3.0
saves a monster's values from its stat block; other characters get 0.
