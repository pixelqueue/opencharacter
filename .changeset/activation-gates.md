---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Two conditions that read the computed sheet beside activation (#232, #234).

A grant may say `available`: a condition evaluated on the computed sheet (derived fields bound,
`self`, `item`, `x` and `i` as in its `when`), ANDed into the `available` of every action the
granted content offers and of the content it grants or picks in turn. The content stays active
and listed; computeSheet's `activations` marks it `unavailable: true` while the condition fails,
its actions aren't listed, startAction refuses them (`unknown-action`), follow-ups don't offer
them, and it declares no follow-ups and projects no auras. So a Draw Steel treasure grants its ability only with a matching kit.

A content type, or an item in place of its type's, may say `effectsWhen`: a condition ANDed into
the `when` of every holder effect of its items (the type's, the item's own, its choices' and
inline options', on fields, rolls, steps, params and incoming changes) and its holder auras'
`when`, evaluated as the effect's `when` is. `scope: applied` effects and auras, whose `self` is
the entry, don't read it. `true` on an item lifts the type's. So 5E's attunement or ORC's
investment is written once on the type. Neither condition decides activation, so neither can
loop back into it; a loop through `effectsWhen` is `circular-formula`, as through a `when`.
Conformance suite: `sheets/grant-available`, `sheets/grant-available-met`,
`sheets/effects-when`, `sheets/effects-when-met`, `sheets/effects-when-circular`,
`sheets/effects-when-applied`, `changes/grant-available-follow-up`,
`actions/effects-when-roll`, `actions/grant-available-start`, `loads/activation-gate-checks`.
