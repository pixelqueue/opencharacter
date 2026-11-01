---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A `changes` effect on a tagged changes step may set the action's flags (`value.flags`, only
flags the action sets elsewhere, checked at load as an added option's), before the step's own
changes and per participant in an `each` step, so content adds to what a shared action works out
(forced movement) or turns off one of its changes ("instead"). Its changes may come first, with
`order: before`, so a gain counts before the step's own spending clamps the field. A proposed
change's `by` that gives dice is rolled by the action: a dice checkpoint at the step matched by
the change's tags, logged with its `faces`, `dice`, `total`, and the change's `tags` and
`field`, which a pause also puts on each die it asks for (#191).
