---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A grant may say `forEach`, a list evaluated as its `when` is: it is made once per element, with
`x` bound in its `when`, `item`, `state` and `choices`. Its `item` may be `{ query }`: every
visible item the query matches, each its own grant. So one core grant covers every key of an open
family, an add-on's key and content included:
`{ forEach: keysOf('psychic'), when: "fieldOf('skills.{psychic}.level', x) >= 0", item: { query: { type: technique, where: item.core && item.discipline == x } } }`.
