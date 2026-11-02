---
'@opencharacter/cwn-srd': patch
---

Veteran's Luck is modeled. Once a scene (`scene.veteransLuck`, cleared by `end-scene` and `rest`) it turns a missed attack into a hit, an option on the attack's new `missed-attack` choice step (reached only when the attack misses a known AC and the edge's luck is unspent; recommended: keep the miss), or a hit against the character into a miss: the `veteransLuck` situational choice, selected on a weapon hit's damage (`damage.weapon`), takes the attack's batch to no damage without spending Damage Soak, deck Shielding or a Neural Buffer.
