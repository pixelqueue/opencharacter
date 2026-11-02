---
'@opencharacter/5e-srd-5.1': minor
---

Reactions to who hit you, read from the damage's sender (`change.from`): Hellish Rebuke offers its cast when another creature damages the caster; Fire Shield offers `erupt` when a creature hits the caster with a melee attack while the shield is up; Multiattack Defense records each creature that hits the ranger with an attack (a required follow-up, in the pick's new `hitBy` state), exposed as `combat.multiattackDefense` so that creature's later attack rolls against the ranger take -4 (as +4 AC). A new `turn-boundary` clock rules action, run by the app on every creature at each turn change, clears it. Breaking: Fire Shield's `erupt` is listed on the spell's holder while the shield is up, no longer on the applied entry (`scope: applied`).
