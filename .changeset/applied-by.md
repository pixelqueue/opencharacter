---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Applied entries record who applied them: `appliedBy`, the applier's character ID (optional, so
saved entries without it stay valid). Every `applyEffect` an action or follow-up proposes carries
the actor's ID; formulas read it as `self.appliedBy` and in `character.applied`. An applied query
may keep to one applier's entries (`applied.appliedBy`; `appliedBy: self` in a proposed change).
A step, option, added changes, roll effect `then` or follow-up may send changes `to: applied`:
every character holding an entry the actor applied. Each is proposed once with no `character`,
its query limited to the actor's entries, for the app to apply to every character that may hold
one; anything but a removeEffect, toggleEffect, setState or adjustState naming applied entries by
query is `invalid-applied-change` at load, as are a follow-up `to: applied` without `changes` and
a role named `applied`. The app applies a run's changes in the order proposed, across characters. `reapply` gives a merged entry the new applier, and
`match: [appliedBy]` keeps one entry per applier (#187).
