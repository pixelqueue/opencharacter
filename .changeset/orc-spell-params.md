---
'@opencharacter/orc-2e': minor
'@opencharacter/orc-sf-2e': minor
---

A spell whose caster picks its damage type or battle form declares the choice as a parameter of
its own cast (a `params` effect), offering only the types or forms the spell names: resist
energy's `resistType`, telekinetic projectile's `physicalType`, animal form's `animalForm`, and
so on. `cast-spell` no longer takes `damageType` or `form`, and the spell type's
`damageTypeChoice` field is gone (breaking: an item field removed). Elemental toss and elemental
blast deal the elemental influence's type; dragon breath and flurry of claws the draconic
exemplar's tradition's, unless the cast names one. Saved characters are unchanged: the applied spell
keeps its `damageType` and `form` state.
