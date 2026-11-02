---
'@opencharacter/5e-srd-5.2': patch
'@opencharacter/spec': patch
---

The Rod of Alertness's Protective Aura, Aura of Life, Holy Aura, Pass without Trace and Spirit Guardians project their aura from each applied entry the creature applied itself (`scope: applied`), one aura per entry (computeSheet's `auras` names that entry), whatever the spell was cast from. Aura of Courage and Aura of Devotion are auras for allies in `paladin.auraRange`, down while the paladin is Incapacitated, with `immuneTo` (Frightened, Charmed), so allies' immunity is no longer text.
