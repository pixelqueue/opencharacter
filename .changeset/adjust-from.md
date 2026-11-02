---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

An `adjust` may carry `from`, the ID of the character whose action or follow-up sent it. Actions
fill it in on every adjust they propose for another character (`to` a role, `target`, a link or
`applied`; not one for the actor's own view in a role), and follow-ups on every adjust for another character; changes `to: self` carry none.
Its field entries keep it: an `on` follow-up reads it as `change.from` (`''` when none) and
stores it in its `cause`, and `batch.adjustments` entries have it. Expected proposed changes in
the conformance cases now include it (#187).
