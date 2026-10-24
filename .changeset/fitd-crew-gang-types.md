---
'@opencharacter/fitd-crew': minor
---

Open to add-on packs. The gang types are a family (`gang`), so an add-on adds one with its
elite upgrade: `upgrades.elite.<type>` are written once for the family, Elite and claim scale
read the types by key (`cohorts.elite`, and `cohorts.trained` from the claims' new hidden
`cohorts.claimed`), and the creation's gang pick offers the family's types, an add-on's named in
its text (`actions.create-crew.options.<type>.name`). The enums holding a
gang type are open: a crew type's `startingCohort`, a claim's `scaleGang`, and a cohort's
`gangType` and `extraGangType` and a claim's `trainedGang`, which move from the Gang and
Training Rooms items to the `cohort` and `claim` types (text under `types.cohort.state.*` and
`types.claim.state.*`; a claim's new `trainsGang` field, Training Rooms', shows the pick).
Creation's choice steps, its starting step and the crew advance's pick carry tags for an
add-on's options and changes.
