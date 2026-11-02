---
'@opencharacter/5e-srd-5.2': minor
---

Deflect Attacks reduces an attack's total damage once: the `deflectAttacks` situational choice is `scope: batch`, so one selection reaches every damage type of the attack, its 1d10 + bonus spent over them in order. Whether the attack deals Bludgeoning, Piercing or Slashing damage is the player's call when selecting it. When all the damage is stopped, its `changes` offer the new `deflect-redirect` follow-up (a rules action running the feature's action). Breaking: the choice is batch-scoped, and the `deflect-attacks` action no longer rolls the reduction: its `damage` parameter and `deflected` result are gone; it is the redirect (1 Focus Point, the redirected damage).
