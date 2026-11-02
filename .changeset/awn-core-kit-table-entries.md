---
'@opencharacter/awn-core': minor
---

A wasteland warrior who picks one item from the d20 table now chooses among that table's named entries ("Rifle and two magazines", "Scrap mail") instead of "Entry 1" to "Entry 20": `starting-equipment` asks `nearEntry` or `wastelandEntry` by the kit, and the wasteland's three salvaged-tech entries are one option. Apps or scripts that answered the old `entry` step with a value from 1 to 20 answer `nearEntry` or `wastelandEntry` with the new option IDs (`near-rifle`, `wasteland-scrap-mail`, …) instead. The step only adds items, so saved characters are unaffected.
