---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A situational choice's `changes` may `setState` or `adjustState` held copies, named by a
`copies: { type, where }` query with an optional `limit`, as a change aimed at copies is. They
apply once per batch with the choice's other changes, after the batch's last change; `where`,
`value` and `by` are evaluated per matched copy with `item`, `self`, `situational` and `batch`
bound, in the choice's pack, and each match is checked as a `setState` or `adjustState` naming
it. Their `{ copies }` entry in `adjustments` carries the choice as `source`. At load, a state
key the content type doesn't declare (or an `adjustState` of a non-numeric one) is
`invalid-situational-change`, and an unknown content type is `unknown-reference`. Shield Block
can now reduce a whole attack by the shield's hardness once and give the shield the rest (#244).
