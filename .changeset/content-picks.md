---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Formulas read the picks of content other than their owner. `picksOf(content, choice)` is the
picks of that content's choice on every activation of it, granted ones included, in activation
order (a grant's preset picks where it presets the choice); it is bound wherever a character is
but activation conditions, field formulas, constraints, display hints and situational choices
included. `grantedPicksOf(content, choice)` is the saved picks of a choice of content the
formula's owner grants, bound where `picksOf(choice)` is, activation conditions included, so a
grant can preset its pick from another grant's (Starfinder 2e's Fixation). Both take string
literals; unknown content or choices are `unknown-reference` at load (#69).
