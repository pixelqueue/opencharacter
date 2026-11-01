---
'@opencharacter/5e-srd-5.1': patch
'@opencharacter/spec': patch
---

Spells with a per-cast choice ask for it and apply it, as 5.2's do: the spell type has `castOptions` and the `option` state, and `cast-spell` asks for the option per target (or for the caster) and saves it on the applied spell. Protection from Energy (resistance to the picked type), Fire Shield (warm or chill: resistance to cold or fire, and an `erupt` action for the 2d8 on a melee attacker instead of damage at the cast), Enhance Ability (advantage on the picked effect's ability checks), Enlarge/Reduce (advantage or disadvantage on Strength checks and saves, ±1d4 weapon damage) and Blindness/Deafness (blinded or deafened on a failed save) use it. Conformance suite: `5e-cast-aid-upcast` expects the applied spell's empty `option`.
