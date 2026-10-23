---
'@opencharacter/5e-srd-5.1': minor
---

Uses the new format features. Arcane Recovery sums the picked slot levels (`steps.slots.values`)
and counts each level's picks against its spent slots. The once-per-rest invocations and Infernal
Legacy mark their own pick or grant (`pick: owner`, `grant: owner`). A long rest resets
invocations, Draconic Ancestry, Infernal Legacy and Relentless Endurance only when one was used
(`countPicks`, `countGrants`). Colossus Slayer is offered from Hunter's Prey's pick (`picksOf`);
the hidden `hunter.colossusSlayer` field is removed.
