---
'@opencharacter/orc-2e': patch
---

The champion's aura feats are auras (#208): computeSheet lists Aura of Courage, Aura of Despair,
Aura of Determination and Aura of Life for the app to put on the creatures inside, sized by the
new `champion.auraSize` (30 feet while Expand Aura's new effect is up). Aura of Courage lowers an
ally's frightened value at the end of the champion's turn through `turn-boundary`. Aura of Life
also gives the champion its +1 status bonus to saves against void. The auras are down while the
champion is unconscious.
