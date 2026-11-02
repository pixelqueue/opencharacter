---
'@opencharacter/swn-revised': minor
---

Burst fire is now a `burst` parameter that only burst weapons' own attacks offer, in place of the `burst` situational every attack offered. It still spends three rounds for +2 to hit and damage, and fires one round for no bonus with fewer than three left. Apps that selected the `burst` situational choice on `attack` pass the `burst: true` parameter instead; the situational choice is gone.
