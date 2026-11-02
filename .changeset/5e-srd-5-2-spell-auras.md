---
'@opencharacter/5e-srd-5.2': patch
'@opencharacter/spec': patch
---

Spirit Guardians, Aura of Life, Holy Aura and Pass without Trace are auras (`auras`). Casting Spirit Guardians also puts the spell on the caster (a `changes` effect on `cast-spell`'s concentration step, now tagged `spell.concentrate`), which holds its 15-foot aura up: enemies inside have their Speed halved. Its new `guard` action runs the Wisdom save and the 3d8 (plus 1d8 per slot level above 3, Radiant or, with `necrotic`, Necrotic) for a creature the Emanation reaches, at the caster's spell save DC and without spending a slot, while the caster concentrates. Aura of Life (Necrotic resistance), Holy Aura (Advantage on saves, Disadvantage on attacks against them) and Pass without Trace (+10 Stealth, counted once by stackKey `source`), cast with no target, hold their auras up for allies. Conformance suite: `5e52-spirit-guardians-guard`, `5e52-cast-spirit-guardians-aura`, `5e52-spirit-guardians-aura`, `5e52-spirit-guardians-enemy` and `5e52-paladin-aura-ally`.
