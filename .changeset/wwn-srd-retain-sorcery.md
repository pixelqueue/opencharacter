---
'@opencharacter/wwn-srd': patch
---

Retain Sorcery gives the casting back: committing its Effort after a cast takes one off `spells.castsUsed`, so the spell doesn't count against the day's castings (an Invoker's spell points aren't refunded). `cast-spell`'s spend step and `commit-effort`'s commit step are tagged `spell.cast` and `art.commit`, so content (and add-ons) can add changes to them.
