---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
'@opencharacter/text': minor
---

Action parameter errors (`missing-param`, `wrong-type`, `out-of-range`, `invalid-option`) carry
`action` (the qualified action ID; `<item ID>#<action ID>` for an item's inline action) and, for
an action started on them, `entry` and `source`. Text names the parameter by its label
(`"Helpers (+1 each)" must be at least 0.`).
