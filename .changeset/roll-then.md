---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Roll effects may carry `then`: after a roll step, each effect that changed the roll (its `when`
held, stacking kept it, and it made a difference: an advantage of the kind that applies once
sources combine, a bound that moved the total, …) proposes its `then` changes once, `to: self`,
with the roll step's path. `entry: self` resolves to the copy or applied entry (or the pick's or
grant's state for a key it declares), and `removeEffect` ends an applied entry, so a "next roll"
effect like 5E's Sapped ends itself. A `then` change may also name `pick: owner` or
`grant: owner`, the pick or holder grant that activated the effect's content, on incoming-change
effects too (#68).
