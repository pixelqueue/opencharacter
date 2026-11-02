---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A situational choice on incoming changes may declare `changes`, what choosing it costs or gains:
`set` and `adjust` of the character's input fields and `offerFollowUp` of a rules follow-up, each
with an optional `when`. applyChanges applies them once per batch that selects the choice, however
many of its changes do, after the batch's last change; their formulas see the character as the
batch left it, `situational` and `batch`. Their adjusts skip incoming-change effects and clamp as
any adjust, and the `requested` entry in `adjustments` carries the choice as `source`. The
returned `changes` don't list them: the selecting change brings them back on replay, so a log
replays batch by batch. A choice with `changes` selected at two values in one batch is
`situational-unavailable`. At load, a follow-up the rules don't declare is `unknown-reference`
(kind `follow-up`); a derived or non-numeric field, or a follow-up parameter its action doesn't
take, is the new `invalid-situational-change`; an undeclared tag is `unknown-tag`. Adding or
changing an existing choice's `changes` changes how logged batches replay: a breaking bump for
the pack (#192).
