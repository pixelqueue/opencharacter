---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Formulas read content by ID. `itemField(id, name)` is an item field of that content as merged
at load (`extends`, overrides and its type's defaults; no copy's templates), read as
`item.<name>` is; `itemField(id, name, default)` gives `default` when the content lacks the
field or the ID names none, else `no-such-key`. `itemTags(id)` is its tags. The ID may be
computed (a pick); the name is a string literal. Both are bound wherever a character is,
activation conditions included, so a pick's fields need no mirror field. At load, an item field
name no content type declares, a literal ID naming no content, or one whose type lacks the
field, is `unknown-reference` (#154).
