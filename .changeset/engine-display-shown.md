---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

computeSheet evaluates display visibility: each value has `shown` (not `hidden`, its `showWhen`
holds, and it is in no fields group or a shown one), and `groups` lists every display group with
`shown` and a fields group's member fields. `showWhen` sees the copy aggregates and `hasChoice`,
so a `countCopies` condition no longer needs an app-side evaluator.
