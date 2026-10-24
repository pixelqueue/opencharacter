---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A roll effect's `then` may be a rule, `{ changes, when, once, to }`. `when: applied` fires it
when the effect was in play on the roll (its target matched and its `when` held), even if
stacking dropped it or an opposite kind cancelled it, so 5E's Sapped ends on the next attack
roll either way; `changed` (the default) keeps today's rule. `once: roll` proposes it once per
roll step run (each pass of a group its own) instead of once per action run (the default,
`action`). `to` sends the changes to another character (a role, `target`, a link) as a
`changes` step's, so an attacker's effect that reads its target's view ends the target's entry
(5E's Vexed); such a `then` needs no entry of its own and may sit on the rules' effects (#153).
