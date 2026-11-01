---
'@opencharacter/5e-srd-5.1': minor
---

A monster's traits and actions are copied onto its sheet, as in 5e-srd-5.2 (#181). The `monster`
item lists them in stat-block order (`entries`, replacing its grants and `ownCopies`), and
`create-monster` adds a copy of each, so every one keeps its own uses and recharge and a GM can
drop or change one on a single monster. Monster traits and Spellcasting are `monsterAction` items
(`kind: trait`); each monster action has an `order`, and the spellcasting fields are
`spellAbility`, `spellDc`, `spellAttack`, `casterLevel`, `innate` and `slots1`–`slots9`. The
`monsterSpellcasting` type is gone, and the sheet's traits and actions group is sectioned and
sorted by stat-block order. Upgrading from 0.3.0 turns a saved monster's granted traits and
actions into copies, keeping their saved uses and recharge.
