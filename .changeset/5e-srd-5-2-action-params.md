---
'@opencharacter/5e-srd-5.2': patch
'@opencharacter/spec': patch
---

Chromatic Orb's first orb is its cast: the spell adds a `damageType` parameter to its own `cast-spell` (a `params` effect), and `cast-spell`'s new `spell.cast` step (its listing is tagged `spell.cast` too) sets the cast's damage type from it, so the ranged spell attack and the 3d8 (+1d8 per slot level above 1) come with the slot spent. The `orb` action stays for a leap. Conformance suite: `5e52-cast-chromatic-orb-type`.
