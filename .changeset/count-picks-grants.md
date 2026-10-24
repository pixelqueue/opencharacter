---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Formulas count saved picks and active grants: `countPicks(cond)` goes over every saved pick of
content (file order) with `pick` bound to `{ item, type, tags, fields, state }`, declared state
defaults applied, and `countGrants(cond)` over every active holder grant with `grant` bound the
same way. `countGrants` is unbound in activation conditions, which decide the grants. A rest's
`when: countPicks(pick.type == 'invocation' && pick.state.used) > 0` proposes its reset only
when a pick was used (#70).
