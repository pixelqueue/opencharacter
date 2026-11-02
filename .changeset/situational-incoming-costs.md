---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A situational choice on incoming changes may declare `changes`, what choosing it costs or gains:
`set` and `adjust` of the character's input fields and `offerFollowUp` of a rules follow-up, each
with an optional `when`. applyChanges applies them once per batch that selects the choice, however
many of its changes do, after the batch's last change; their formulas see the character as the
batch left it, `situational` and `batch`. Their adjusts skip incoming-change effects, and the
`requested` entry in `adjustments` carries the choice as `source`. The returned `changes` don't
list them: the selecting change brings them back on replay. A follow-up a choice offers that the
rules don't declare is `unknown-reference` at load (#192).
