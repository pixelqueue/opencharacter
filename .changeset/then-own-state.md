---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

An incoming-change effect's `then` on picked or held granted content changes the state its `self` reads: its pick's state or its grant's saved state, for keys that content declares. A rules-level pick's own state is writable this way too, though it has no entry. Output change: `adjustments` address a `then` state change as a setState would, with the pick's `path` and `option`, or with `grant`, instead of always the copy's `entry`. A change to a grant that an earlier `then` turned off is skipped.
