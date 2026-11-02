---
'@opencharacter/awn-core': minor
---

`attack` offers `burst` only on burst weapons and a new `thrown` parameter only on melee weapons that can be thrown, in place of the `burst` situational choice. A thrown attack is ranged and deals no Shock. Armsmaster and Deadeye now both reach thrown attacks, and only the better of the two counts there (the `thrown-focus` stack key, spanning hit and damage). Apps that selected the `burst` situational choice on `attack` pass the `burst: true` parameter instead; the situational choice is gone.
