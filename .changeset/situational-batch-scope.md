---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A situational choice on incoming changes may be `scope: batch`: selected on one adjust, its
incoming-change effects reach that adjust and every later adjust of the batch its `incoming`
matches, and each `add` among them is worked out once (dice rolled once, the faces on the adjust
that rolled) and spent toward 0 over the changes in order, what one doesn't take carrying to the
next: an attack's total damage reduced once. Selecting it on a second change of the batch is
`situational-unavailable`. Incoming-change effects now see `batch`, whose entries gain `taken`,
and their `then` sees `incoming.taken` (the amount after every incoming-change effect) and
`incoming.rolled` (the effect's own dice total). Making an existing choice batch-scoped changes
how logged batches replay: a breaking bump for the pack (#215).
