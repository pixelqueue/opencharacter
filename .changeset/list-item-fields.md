---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Item fields may be of the new type `list`: members of kind `of` in the order written, where a
`set` comes out sorted; duplicates are allowed unless the declaration says `unique: true`.
Formulas see a `list<string>` in that order, content and field members qualified as a set's
are. A value that isn't a list, or a `unique` list with a member twice, is
`invalid-item-field` (`wrong-type`) at load; a per-copy value is checked the same way. `list`
is for a content type's `fields` and `templateFields` only: on a state key or parameter it is a
validation error (#152).
