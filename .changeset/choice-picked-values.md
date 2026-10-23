---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A repeated choice step over values has `steps.<id>.values`: the picked values in order, numbers
staying numbers, so Arcane Recovery sums `sumList(steps.slots.values, x)` instead of mapping
each option ID back to its value (#73).
