---
'@opencharacter/fitd-crew': patch
---

The `claim` type's `effectsWhen` (`item.prison || !lair.lost`) turns off a lair claim's effects while the lair is lost, in place of the `!lair.lost` on each claim's effects; an add-on's claims follow it too. No saved shape changes.
