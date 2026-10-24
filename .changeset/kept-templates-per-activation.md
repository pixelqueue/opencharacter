---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Templates kept on content without a copy are kept per activation, not per item: a `content`
query that reads the keeper also sees `owner`, the candidate's owner (`owner.id`, its key root as
`choice.owner`, and `owner.item`), so Eldritch Spear lengthens a cantrip only where the Warlock
knows it. Breaking: computeSheet's `templated` lists such content once per activation, with
`activation`, its index in `activations` (#76).
