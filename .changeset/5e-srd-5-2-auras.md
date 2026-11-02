---
'@opencharacter/5e-srd-5.2': patch
---

Aura of Protection and the Rod of Alertness's Protective Aura are auras (`auras`): computeSheet lists them while they are up (Aura of Protection while the paladin isn't Incapacitated, at `paladin.auraRange`; the rod while planted) for the app to place on allies inside. Aura of Protection's entry reads the paladin's live Charisma modifier through `appliers`. A creature in two Auras of Protection benefits from the highest (stackKey `source`), and the holder in its own aura counts it once.

An aura is up only through its holder's own entry (one with no applier or applied by the holder), so a creature standing in another's Rod of Alertness, Spirit Guardians, Pass without Trace, Aura of Life or Holy Aura doesn't project it too. Conformance suite: `5e52-spirit-guardians-aura-not-passed-on`.
