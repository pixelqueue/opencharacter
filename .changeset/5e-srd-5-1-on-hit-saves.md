---
'@opencharacter/5e-srd-5.1': minor
'@opencharacter/spec': patch
---

`weapon-attack`, `unarmed-strike` and their damage steps are tagged `attack-hit` (the unarmed strike also `unarmed`). Stunning Strike and Open Hand Technique are parameters of those attacks (`stunningStrike`; `openHand` on the unarmed strike): on the hit, an `action` effect on that step spends the ki and hands the target its saving throw at the ki save DC, stunned or knocked prone on a failure. Breaking: the `stunning-strike` and `open-hand-technique` actions, which only reported the DC, are removed. A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
