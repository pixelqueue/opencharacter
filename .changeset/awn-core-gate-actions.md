---
'@opencharacter/awn-core': patch
---

Creation actions (`mutate`, `roll-stigma`, `roll-negative-mutation`, `buy-mutation`,
`roll-mutation`, `reassign-barred-skills`, `starting-equipment`, `kit-entry`, `gain-benefit`) are
available only while the character is being created, and the helpers `gain-skill`, `bonus-skill`
and `skill-points-toward` are no longer listed. `gain-edge` and `gain-focus` are available only
when the level owes an edge or a focus level. Creation, level-up and the edges and foci that run
them are unchanged.
