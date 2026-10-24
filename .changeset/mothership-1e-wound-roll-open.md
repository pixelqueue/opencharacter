---
'@opencharacter/mothership-1e': minor
---

`wound-roll`'s `woundType` parameter is an open enum, so an add-on's wound type is rolled as the
core's are. The roll finishes with the result `rolled` and the type in its data (`woundType`),
in place of one result per wound type.
