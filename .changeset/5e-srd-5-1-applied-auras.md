---
'@opencharacter/5e-srd-5.1': minor
'@opencharacter/spec': patch
---

Countercharm, the Rod of Alertness's Protective Aura, Pass without Trace and Spirit Guardians project their aura from each applied entry the creature applied itself (`scope: applied`), one aura per entry, whatever the spell was cast from. Aura of Courage and Aura of Devotion are auras for friendly creatures in `aura.range` while the paladin is conscious, with `immuneTo` (frightened, charmed). Breaking: their `aura-of-courage` and `aura-of-devotion` `ally` actions are removed; `ally` entries saved before keep their immunity. A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
