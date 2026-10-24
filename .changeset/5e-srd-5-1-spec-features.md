---
'@opencharacter/5e-srd-5.1': minor
---

Uses the new format features. Arcane Recovery sums the picked slot levels (`steps.slots.values`)
and counts each level's picks against its spent slots. The once-per-rest invocations and Infernal
Legacy mark their own pick or grant (`pick: owner`, `grant: owner`). A long rest resets
invocations, Draconic Ancestry, Infernal Legacy and Relentless Endurance only when one was used
(`countPicks`, `countGrants`). Colossus Slayer is offered from Hunter's Prey's pick (`picksOf`);
the hidden `hunter.colossusSlayer` field is removed.

Open to add-on packs: each class and background carries its own starting `kit` action
(`startingKit`), a class orders a random start's abilities (`abilityPriority`, an ordered list of ability scores) and names its
multiclass requirements (`multiclassAll`, `multiclassAny`), magic items name the classes that can
attune (`attunementClasses`, replacing the `attunement.<class>` tags), containers add their own
capacity, rests carry `rest.long` and `rest.short` for content to reset its uses, and Metamagic
and the Hunter's options are `metamagic` and `hunterTactic` content. Saved Metamagic and Hunter
picks move to the content IDs (upgrade 0.2.0 to 0.3.0). Starting equipment steps read
`equipment/class/…` and `equipment/background/…`.
