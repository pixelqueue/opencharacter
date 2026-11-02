---
'@opencharacter/mothership-1e': minor
'@opencharacter/spec': patch
---

mothership-1e (breaking: a situational choice is removed): the Android's trauma response is an aura (`unease`, on allies) that puts Fear saves at [-], replacing the situational choice `android`. Homebrew that reads `situational.android` no longer loads, and an app that passes it has it ignored.

What apps must change:
- Apply the Android's `unease` aura entry (`applyEffect` with `source: mothership-1e:classes.android`, `aura: unease`, `appliedBy` the Android) to each close crewmate, and remove it as they leave, instead of passing `situational.android`.
- Bleeding: run EITHER the new `turn-boundary` clock action at every turn change (it takes a bleeding character's health as its own turn starts) OR `bleed` once a round, never both, or bleeding counts twice.

Also: the weapon type's `use` entries offer `shoot` or `attack` by the magazine (`available` on the use), and shore leave's split recommends every converted point to the lowest save, so an unattended run finishes. No saved shape changes. Conformance cases for the aura, the turn change and the recommendation.
