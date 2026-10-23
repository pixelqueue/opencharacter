---
'@opencharacter/fitd-crew': minor
---

A crew type's `startingCohort` is an enum of the five gang types or `none` (the default), so a custom crew type can't name a gang type that doesn't exist. `create-crew` takes the factions' names as params (`groundsFaction`, `helpedFaction`, `harmedFaction`, `friendFaction`, `enemyFaction`): a step whose name is given adds a faction with that name and its status, so the status paid for lands on the sheet; with no name and no faction, the outcome still reports it. The cohort type's formulas read the gang and expert state only where a cohort declares it, so a homebrew cohort rolls and computes its scale. Claim and upgrade modifiers show only once they're set, `cohorts.boxes` is background, and the Quality upgrades read as upgrades ("Documents quality upgrade") beside the ratings they raise.
