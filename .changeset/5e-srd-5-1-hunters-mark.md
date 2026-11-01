---
'@opencharacter/5e-srd-5.1': patch
'@opencharacter/spec': patch
---

Hunter's Mark is modeled, as in 5.2: casting it applies the spell to the target with the caster's ID (the spell type's new `caster` state), the target's `huntersMark.markedBy` lists who marked it (also in the `target` view), and the caster's weapon damage against a creature it marked adds 1d6 of the weapon's type. Conformance suite: `5e-cast-aid-upcast` expects the caster's ID on the applied spell.
