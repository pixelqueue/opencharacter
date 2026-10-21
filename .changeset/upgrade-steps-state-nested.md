---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Upgrade steps `removeState`, `moveState` (a copy's state to a pick or to granted content's saved state) and `removeChoice`; `renameState` also renames picks' and grants' saved state. A choice step's `owner` can be a path to a choice nested in an inline option (`classes.operative/specialization/ghost`). `checkRelease` no longer reports written `values` replaced by a formula as removed options.
