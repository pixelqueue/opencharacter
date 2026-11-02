---
'@opencharacter/orc-2e': minor
'@opencharacter/orc-sf-2e': minor
'@opencharacter/spec': patch
---

orc-2e and orc-sf-2e: Shield Block (`situational.shieldBlock`) reaches the whole attack (`scope: batch`). The shield's hardness comes off the attack's total once, however many damage types it splits into, and the raised shield takes what is left of the total, clamped to its remaining Hit Points: a block that destroys the shield no longer rejects the attack. The shield type's per-change `block` effect is gone, so the shield's `damage` entry in `adjustments` is now a `{ copies }` entry whose `source` is the choice (`{ type: situational, id: shieldBlock }`), not the item's `block` effect.

What apps must change: select `shieldBlock` on the first damage change of an attack and route the attack's damage as one batch. The Shield spell and Fire Shield still block per damage change (#258).

No saved shape changes. Conformance cases: a split Strike blocked once, and a block past the shield's Hit Points.
