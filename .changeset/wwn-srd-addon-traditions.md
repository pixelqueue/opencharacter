---
'@opencharacter/wwn-srd': minor
---

The Mage's and the partial Mage's traditions are content of the new type `tradition` (its `trad` key in `key`) instead of inline options, so an add-on pack's tradition is offered too; the upgrade script renames saved picks (`high-mage` → `traditions.high-mage`, and so on). `tradition.<key>.tier` counts the picked tradition (2 under a class tagged `full-mage`, else 1). Each tradition's creation bonus skill is the new field `tradition.<key>.skill`, set by the content that brings the tradition, and creation gains them in one loop instead of a step per tradition. The spell lists a caster learns from read the tradition keys (`item.list` is a `trad` key, or `high`), and the spell-casting traditions are the new family `spellTrad`, so the casting mode, the spell picks and the spell-known check follow added traditions.
