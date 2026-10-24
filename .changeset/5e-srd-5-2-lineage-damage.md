---
'@opencharacter/5e-srd-5.2': minor
---

Breath Weapon and Damage Resistance take their damage type from the grant: each declares a hidden
`damageType` state key, which the dragonborn's grants set to its picked lineage's `damageType`
(`itemField`), so any species granting them passes its own lineage's. The hidden
`origins.draconicDamage` field and the lineages' effects setting it are removed, so a dragonborn
lineage needs only its `damageType`.
