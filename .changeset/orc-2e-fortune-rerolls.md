---
'@opencharacter/orc-2e': patch
'@opencharacter/orc-sf-2e': patch
'@opencharacter/spec': patch
---

A check's reroll option may keep the better result (`reroll` flag 2) as well as the new one
(1). Halfling Luck (a failed skill check or save), Cat's Luck (a failed Reflex save, the better
result) and Spiritual Guides (a failed, not critically, Perception or skill check) offer their
once-a-day rerolls on `check.reroll`, marking the feat used (a `used` state key, reset by daily
preparations). Conformance suite: `orc-halfling-luck-reroll`.
