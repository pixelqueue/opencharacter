---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Derived parameters: an action parameter (its own, or one a `params` effect adds) may declare a
`formula` instead of being given. startAction works it out once every given parameter has its
value and before any bound, in declaration order, reading the given parameters and the derived
ones before it (a later one is `unknown-name` at load, so they can't loop), and the run's
`participants`, now checked before the parameters (`invalid-participants` comes first); everything reads it
as `params.<name>`. A value for it from the app, a `use`, an `action` step or a handoff is the new
error `invalid-param` (reason `derived`). describeAction lists it with `derived: true`.

Effects that act as an action runs (on rolls, choice and changes steps, listed actions and
incoming changes) read their content's computed values as `self.<name>`, as its actions do. A
field effect still can't (`unknown-name` at load): computed values are worked out after every
field, so one feeding a field could loop. So Cunning Strike's cost is worked out once, and its
DC is a computed value its strike effects read (#251).
