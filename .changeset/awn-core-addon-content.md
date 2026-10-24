---
'@opencharacter/awn-core': patch
---

Add-on packs' content joins creation and advancement. The prepared survivors' picks are content of the new type `prepared` (the item, quantity, readied, and what comes with it). A wasteland warrior's missile weapon is any primitive weapon with the new item field `kitAmmo`, which it comes with. Edge and focus limits are tags (`repeatable`, `first-edge`, `needs-mutant`, `makes-mutant`, `not-mutant`, `not-underdog`) instead of IDs; an edge or focus with the new item field `gainPart` runs its own `gain-part` action when taken (Educated, Mutant, Mutation Acceleration, Unstable Mutant), and edges give mutation points through the new field `mutations.points.edges`.
