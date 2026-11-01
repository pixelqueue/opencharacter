---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Recommendations that follow the character (#195). A declared choice's `recommend` sees
`options`: the options it offers that are eligible apart from prerequisites (in `from` and its
`where`, passing `eligible`, not taken elsewhere in its `unique` group), in the order offered, so
a choice whose options depend on the character recommends one (`options[0]`) and guided and
random starts over pending choices don't stop there. An allocate step's `recommend` may be one
formula, evaluated per offered field with `field` bound (`{ id, value }`), giving its amount or
`null` for none; and a `recommend` map's entries for fields the step doesn't offer are now
ignored instead of making the recommendation invalid, so one step recommends for whichever
fields its query offers.
