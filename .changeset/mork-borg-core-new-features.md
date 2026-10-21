---
'@opencharacter/mork-borg-core': patch
---

Creation no longer gives the class and companion copies fixed instance IDs: it asks the new class's features through `steps.class.added`, and getting better finds the Gutterborn Scum's copy with a copies choice. The Herbmaster's dose split is a value choice, and creation and brewing name their weapons, armor, ammunition, scrolls and decoctions with `@` refs instead of building ID strings.
