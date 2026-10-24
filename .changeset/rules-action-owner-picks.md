---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

A rules action no copy uses reads the rules-level choices with the one-argument `picksOf` in its
`available` too, as its steps do: computeSheet lists it, and a follow-up's action is checked, with
the rules' picks, not an empty owner. Conformance cases for a rules action's `available`, a
follow-up's action check, and the rules-level formulas where `picksOf(choice)` is unbound.
