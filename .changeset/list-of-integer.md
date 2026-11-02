---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

A `list` item field may hold whole numbers, `of: integer` (#211): its value is a list of
integers, checked at load and per copy (`invalid-item-field` / `wrong-type`), and formulas read it
as `list<int>`. So content carries a table of numbers: a class's characteristic array, a point-buy
cost table, a per-level bonus. `of: integer` is for a `list` only, and `integer` joins the reserved
content type names.
