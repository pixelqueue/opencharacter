---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A stack key may span fields: `settings.stacking.keys.<key>: { policy, spansFields: true, score? }`
groups the key's effects of one op on every field and keeps one source for all of them, by its
score (`sum`, or `{ field }`). `playerChooses` reports it as one `competing` entry with `fields`,
one option per source with its score as `value` and its value per field as `values`; picking it
applies the source on every field. A Draw Steel kit's bonus across three tiers is one bonus
(#197). A score field none of the key's effects targets is the load error `invalid-stacking`. Keys
declared as a plain policy behave as before.
