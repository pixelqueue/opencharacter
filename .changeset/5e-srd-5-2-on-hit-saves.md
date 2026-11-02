---
'@opencharacter/5e-srd-5.2': minor
---

Cunning Strike, Stunning Strike, Open Hand Technique, Hurl Through Hell and the Rod of Lordly Might's Drain Life and Paralyze are parameters of each attack (`cunningStrike`, `cunningStrike2`, `stunningStrike`, `openHand`, `hurlThroughHell`, `drainLife`, `paralyze`). On the hit, an `action` effect on the attack's `attack-hit` step hands the target its saving throw at the feature's DC and applies the condition (or Hurl Through Hell's 8d10 Psychic damage) on a failure; the cost (a Focus Point, the use or a Pact Magic slot, the rod's daily use) is spent with it. Cunning Strike's dice come off the Sneak Attack, read from the parameters. `item-power`'s outcome data adds `failed`. Breaking: the `cunning-strike`, `stunning-strike`, `open-hand-technique` and `hurl-through-hell` actions, the rod's `drain-life` and `paralyze` actions, and the `cunningStrike` situational choice are removed.
