---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A `group` step repeats a sequence of steps: one pass of its `steps`, then another while
`repeat.while` holds, up to `repeat.max` passes (and the new safety limit `maxGroupPasses`).
A step in pass `n` is at `<group>[<n>]/<step>`; `steps.<group>` lists the passes, and after the
group each step reads as its latest result. Fate's reroll-and-reroll-again needs no copies of
its steps (#80).
