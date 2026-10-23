---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

Action parameters' `min` and `max` are enforced: a number parameter outside them is
`out-of-range` (data: `target`, `min`, `max`) when the action starts or is handed off. The bounds
are number formulas evaluated as the action starts, with its `item`, `self`, `situational` and
the character's fields (`max: effort.free`), and are type-checked at load (#111).
