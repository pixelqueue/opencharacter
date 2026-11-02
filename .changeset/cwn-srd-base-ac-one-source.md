---
'@opencharacter/cwn-srd': patch
---

Armor, dermal plating and Skin of Steel set both base Armor Classes from one source: their `set` effects share the `base-ac` stack key, which spans `ac.ranged.base` and `ac.melee.base` (`playerChooses`, the best pair recommended). A medium armored suit (18/14) with Dermal Armor I (16/16) no longer mixes into 18/16.

App state: the competing groups on `ac.ranged.base` and `ac.melee.base` are now one `base-ac` group spanning both fields, with one option per source, so a pick an app saved for the old per-field groups has to be made again.
