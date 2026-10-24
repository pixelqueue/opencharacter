---
'@opencharacter/5e-srd-5.2': minor
---

Uses the new format features. Arcane Recovery is a guided choice of spent slots again, replacing
its five integer parameters. Cast options are one values step over each spell's `castOptions`,
replacing 61 option effects (answers are the value, `str`, not `spells.hex#str`). Sapped ends
itself after the attack roll its Disadvantage changes, on every attack roll. Savage Attacker
rolls the weapon's damage dice twice and keeps the better total. Eldritch Spear lengthens only a
cantrip the warlock knows, and Improved Elemental Fury only the druid's own cantrips. Gift of the
Depths and the species traits mark their own pick or grant (`pick: owner`, `grant: owner`).
Colossus Slayer and the goliath's powers read their picks (`picksOf`); the hidden
`ranger.colossusSlayer`, `origins.giantAncestry` and `origins.giantAncestryLeft` fields are
removed.

Open to add-on packs: each class and background carries its own starting `kit` action
(`startingKit`), a class orders a random start's abilities (`abilityPriority1`–`6`) and names its
multiclass requirements (`multiclassAll`, `multiclassAny`), and magic items name the classes that
can attune (`attunementClasses`, replacing the `attunement.<class>` tags). Starting equipment
steps read `equipment/class/…` and `equipment/background/…`.
