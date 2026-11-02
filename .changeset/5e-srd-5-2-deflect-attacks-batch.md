---
'@opencharacter/5e-srd-5.2': minor
'@opencharacter/spec': patch
---

Deflect Attacks reduces an attack's total damage once: the `deflectAttacks` situational choice is `scope: batch`, so one selection reaches the whole attack, its 1d10 + bonus spent over its Bludgeoning, Piercing and Slashing parts in order (every damage type with Deflect Energy). When all the damage is stopped and a Focus Point is left (the new `focus.spent` field), its `changes` offer the new `deflect-redirect` follow-up (a rules action running the feature's action, available only while a Focus Point is left). Breaking: the choice is batch-scoped, and the `deflect-attacks` action no longer rolls the reduction: its `damage` parameter and `deflected` result are gone; it is the redirect (1 Focus Point, the redirected damage). A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
