---
'@opencharacter/mothership-1e': minor
---

Taking the class loadout at creation sets the new input field `loadout.owed` ("Class loadout owed") on the sheet instead of returning `loadout` as outcome data, so an app or a gear pack knows the loadout is still to be added. The random start draws each skill pick over the eligible skills instead of always the first.
