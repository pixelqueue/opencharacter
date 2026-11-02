---
'@opencharacter/5e-srd-5.2': minor
---

Cunning Strike works out its Sneak Attack dice once, as the attack's derived parameter `cunningStrikeCost`, which the Sneak Attack and the strike effects read; its save DC is the feature's `strikeDc` computed value, read by the strike effects. The `rogue.strikeDc` field is removed (breaking: read the feature's `strikeDc` instead). The rules are unchanged.
