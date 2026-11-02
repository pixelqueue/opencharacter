---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A `tag` roll effect adds tags to a roll's own parts (#212):
`{ target: { rolls, parts }, op: tag, value: [<tags>] }`, entries may be formulas. It applies
after replaced parts and before anything else reads the roll, so content types a part a shared
action builds from the item's own fields (Draw Steel's Dragon Breath and Hurl Element, a damage
type chosen on each use), and later part targets, a `split` and incoming-change effects see the
new tags. Every active `tag` effect counts; it takes no `stackKey`. `pnpm validate` checks its
literal tags.

`loadRuleset` reports a literal tag in a `tag` effect that no visible pack declares as
`unknown-tag`.
