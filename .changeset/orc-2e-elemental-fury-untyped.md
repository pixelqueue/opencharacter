---
'@opencharacter/orc-2e': patch
---

Elemental Fury on a target, before the elemental bloodline's influence is picked, deals untyped
damage instead of computing the undeclared tag `damage.none`. That already failed when the action
ran (`unknown-tag`, a computed tag must be declared), before applyChanges checked change tags.
