---
'@opencharacter/5e-srd-5.2': patch
'@opencharacter/spec': patch
---

Brutal Strike's blows are modeled: the feature adds a blow parameter to every attack (`params` effect), and Improved Brutal Strike at level 17 a second, `brutalBlow2`. When the Brutal Strike hits, Hamstring Blow puts the new `combat-effects.hamstrung` on the target (Speed −15, the most recent one only) and Staggering Blow (Improved Brutal Strike) the new `combat-effects.staggered` (Disadvantage on its next saving throw, which ends it). Forceful Blow's push and Sundering Blow's +5 stay the player's. The combat effects group is labeled "Combat effects". Conformance suite: `5e52-attack-brutal-strike-blows`.

Hamstring Blow ends at the start of the barbarian's next turn: the `turn-boundary` action removes it with Sap and Slow (`5e52-turn-boundary` expects it in the query). Staggering and Sundering Blow are offered from level 13: Brutal Strike's `brutalBlow` (Forceful or Hamstring) gives way there to Improved Brutal Strike's `improvedBlow`, which offers all four.
