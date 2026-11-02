---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

`checkRelease` reports four more interface changes, each needing a breaking bump (#220):
`param-removed` and `param-type-changed` (an action parameter removed, retyped, losing enum
values or becoming required, on a rules action, an item's or a content type's inline action, or
added by a `params` effect) and `situational-removed` and `situational-type-changed`. upgrades.md
says a narrowed `available`, `when` or target can't be compared statically and needs a breaking
bump from the author.
