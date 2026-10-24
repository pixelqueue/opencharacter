---
'@opencharacter/mothership-1e': minor
---

Open to add-on packs: a weapon's `woundType` and a class's `trauma` are open enums, and creation's
class, skills and kit steps (`creation.class`, `creation.skills`, `creation.kit`) and the step
saving the rolls (`creation.save`) are tagged for an add-on's options and changes. A skill's new
`towardMaster` field marks the skills on the way to a Master skill, which the Scientist's Expert
and first Trained picks offer, instead of a list of skill IDs.
