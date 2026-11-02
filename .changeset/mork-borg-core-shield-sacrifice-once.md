---
'@opencharacter/mork-borg-core': minor
'@opencharacter/spec': patch
---

mork-borg-core: a shield sacrifice (`situational.shieldSacrifice`) breaks one shield per blow, the first worn unbroken one, instead of every worn shield on every change that selects it. The choice holds the effect and the break; the shield type's `shield-sacrifice` effect is gone, so the break's entry in `adjustments` is a `{ copies }` entry whose `source` is the choice, not the item's effect. Direct damage still breaks nothing.

No saved shape changes. Conformance case: one of two worn shields breaks.
