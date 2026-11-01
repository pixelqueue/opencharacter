---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Choice picks held as copies, tightened (#195, #196). A choice's `recommend` no longer sees its
own picks in `options`, so `options[0]` is the next to pick. A pick's copy is added under the
option's derived ID plus `_pick`, which no standard copy can have, and `adoptStandard` and the
standard-copy cleanup leave copies picks name alone. Saved copy links are checked: a missing
or dangling link, one to another item's entry, one an earlier pick names, or `entry` on a
choice without `addAs` is the new rules issue `picked-copy-invalid` (data `problem`), and only
links that hold count for `picked-copy` and for removal with the pick. Upgrade steps that remove
a pick remove its copy too. Grant-only content is `option-not-eligible` in an `addAs: copy`
choice; `addAs` with `waivePrerequisites` is a schema error, and `pnpm validate` reports a grant
presetting such a choice and warns on `activeWhen` with `activate: false`. Below a failing
`activeWhen`, the picks' own choices are still listed and asked, inactive too. `checkRelease`
reports a choice gaining or losing `addAs` as the interface change `choice-copies-changed`.
