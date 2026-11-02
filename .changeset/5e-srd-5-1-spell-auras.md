---
'@opencharacter/5e-srd-5.1': patch
'@opencharacter/spec': patch
---

Spirit Guardians and Pass without Trace are auras (`auras`). Casting Spirit Guardians also puts the spell on the caster (a `changes` effect on `cast-spell`'s concentration step, now tagged `spell.concentrate`), which holds its 15-foot aura up: enemies inside have their speed halved; the save and damage stay the cast's. Pass without Trace cast with no target holds its 30-foot aura up for allies; a creature counts one +10 (stackKey `source`).
