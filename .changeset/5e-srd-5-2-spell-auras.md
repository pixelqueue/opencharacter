---
'@opencharacter/5e-srd-5.2': patch
'@opencharacter/spec': patch
---

Spirit Guardians, Aura of Life, Holy Aura and Pass without Trace are auras (`auras`). Casting Spirit Guardians also puts the spell on the caster (a `changes` effect on `cast-spell`'s concentration step, now tagged `spell.concentrate`), which holds its 15-foot aura up: enemies inside have their Speed halved; the save and damage stay the cast's. Aura of Life (Necrotic resistance), Holy Aura (Advantage on saves, Disadvantage on attacks against them) and Pass without Trace (+10 Stealth, counted once by stackKey `source`), cast with no target, hold their auras up for allies. Conformance suite: `5e52-cast-spirit-guardians-aura`, `5e52-spirit-guardians-aura`, `5e52-spirit-guardians-enemy` and `5e52-paladin-aura-ally`.
