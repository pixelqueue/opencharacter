---
'@opencharacter/swn-revised': minor
---

The Warrior's luck against a hit is now the `warriorLuck` situational choice, selected on the hit's incoming damage: the attack (its whole batch) does no damage and the scene's luck is spent. It replaces the Warrior's `negate-hit` action, which only marked the luck spent; apps that ran it select the choice on the damage instead. The attack's `missed-attack` luck step is now reached only by a Warrior with the luck unspent, so a policy that pauses there no longer stops every miss.
