---
'@opencharacter/5e-srd-5.2': patch
'@opencharacter/orc-2e': patch
'@opencharacter/orc-sf-2e': patch
'@opencharacter/spec': patch
---

A field shows in each display group it's in, and the repeat is intended (a summary repeats headline values), so apps don't dedupe; the display-hints doc says so. 5e-srd-5.2's `concentration.active` is in `combat` only, and orc-2e's and orc-sf-2e's spellcasting proficiency ranks (`spellcasting.rank`, the archetype ranks) are in their spellcasting group only, no longer in `proficiencies` too (#175).
