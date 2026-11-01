---
'@opencharacter/mork-borg-core': patch
'@opencharacter/spec': patch
---

mork-borg-core: plain die rolls that are neither tests nor damage (a weapon's doom and curse d6, the Fanged Deserter's bite exposure, rattled wizard teeth, a lobbed gob's blindness, an omen's warding d6) are tagged `chance`, not `attack` or `defense`, so invisibility, the poltroon and the sinner's bonuses no longer reach them and Eurekia's curse can roll a 1. Conformance test for it.
