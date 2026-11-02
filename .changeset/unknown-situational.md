---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A situational choice the app gives that the ruleset doesn't declare is now the error
`unknown-situational` (data `situational`) instead of being ignored: in startAction's
`situational` (an action error), and in an `adjust`'s `situational` in applyChanges (a runtime
error that rejects the batch; it was `unknown-id`) (#220). Apps must drop situational IDs
computeSheet no longer offers, for example after a pack update removes a choice, or the call
fails. A paused action resumed against a newer release is checked again the same way, so one
selecting a removed choice fails with `unknown-situational`: start it again.
