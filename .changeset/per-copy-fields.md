---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Item fields a content type marks `perCopy: true` may have a copy's own value, saved in the
entry's `fields` (`addItem`, and the new `setField` change; `null` removes one) and merged into
its `item` after its templates, so every reader reads `item.limit` for a custom stunt too. The
new error `not-per-copy` names a field that isn't `perCopy`; a copy with own values is listed in
`templated`. The new upgrade step `stateToField` moves a state key to the copy's own field
(#78).
