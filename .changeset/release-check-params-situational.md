---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

`checkRelease` reports more interface changes, each needing a breaking bump (#220):
`param-removed` and `param-type-changed` (an action parameter removed, retyped, losing enum
values or becoming required, on a rules action, an item's or a content type's inline action, or
added by a `params` effect), `situational-removed` and `situational-type-changed`, and
`action-removed` now also covers an inline action or `use` gone from a remaining item or content
type. upgrades.md says a narrowed `available`, `when`, target, bound, `where` or tag `members`
can't be compared statically and needs a breaking bump from the author.
