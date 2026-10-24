---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

An `action` step's `source` without `entry` also finds content that is a copy's own item, listed
by that copy's `entry` (the parent's entry first, else the first): a class added earlier in the
run under `sheet: proposed` runs its own action by its ID, as `entry` finds it by the new copy's
ID. Before, only picked, granted and entryless content matched, so the step was
`unknown-action` (#155).
