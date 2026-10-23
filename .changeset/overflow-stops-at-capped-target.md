---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

An overflow whose adjust on `into` would be clamped to no change (its target at its bound, nothing
absorbed, no overflow of its own) no longer fires: the field clamps instead. Carried overflow
stops cycling once its target is full, so more damage never leaves more health and large
amounts no longer reach `maxOverflowChain` (#100).
