---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Item fields and state keys of type `id`, `set` or `list` of a content type or `field` may say `where`, a condition over each candidate as `item` that reads only `item` (#166). An item's own value outside it is `invalid-item-field` (`not-allowed`) at load; a copy's own value (`addItem`, `setField`) or a state value (`addItem`, `setState`, `applyEffect`) outside it is `invalid-option`, with the item field or state key as `target`. loadRuleset gives each such declaration `options`, the IDs it takes, for an app's picker.
