---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

A content parameter without `where` is checked too: an ID that isn't an item of its type is
`invalid-option` when the action starts, and formulas read the qualified ID.
