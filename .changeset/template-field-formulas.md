---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A template's `string`, `enum` or `id` item field may be `{ formula }`: a string formula read as
its numeric fields are (with `base`, `prior` and `params`), so a kept template takes a value from
its keeper's `params`. Kept templates' `params` read `character.applied`, the saved applied
entries with their state, so a spell's damage type can follow the element of an active spell
(#75).
