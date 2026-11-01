---
'@opencharacter/orc-2e': patch
---

Elemental Fury on a target, before the elemental bloodline's influence is picked, deals untyped
damage instead of computing the undeclared tag `damage.none`, which the engine rejects
(`unknown-tag`).
