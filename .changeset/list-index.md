---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

The list functions (`countList` … `sortList`) bind `i`, the element's position in the list, an
int from 0. A skipped null element keeps its place, so `i` pairs an `each` step's
per-participant results and flags with `participants.<role>`
(`mapList(steps.tier, participants.target[i].id)`). A proposed change or a grant with `forEach`
binds `i` too, beside `x`. `i` is a context root, so a field ID's first segment can't be `i`, as
it can't be any root's name (`x`, `item`, …) (#192).
