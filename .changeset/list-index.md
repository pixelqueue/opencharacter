---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

The list functions (`countList` … `sortList`) bind `i`, the element's position in the list, an
int from 0. A skipped null element keeps its place, so `i` pairs an `each` step's
per-participant results and flags with `participants.<role>`
(`mapList(steps.tier, participants.target[i].id)`). `i` is a context root, so a field ID may no
longer start with it (#192).
