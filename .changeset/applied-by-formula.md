---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A proposed `applyEffect` may name its applier with an `appliedBy` formula giving a character ID,
usually a participant's (`participants.ally[0].id`: frightened of the ally who triggered it);
without one it is the actor, as before. A value that isn't a non-empty string is `type-mismatch`.
Everything that reads the applier follows the named character, so the actor's own changes
`to: applied` no longer reach the entry (#236).
