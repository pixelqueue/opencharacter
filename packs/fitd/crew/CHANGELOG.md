# @opencharacter/fitd-crew

## 0.3.0

### Minor Changes

- f44f66c: A crew type's `startingCohort` is an enum of the five gang types or `none` (the default), so a custom crew type can't name a gang type that doesn't exist. `create-crew` takes the factions' names as params (`groundsFaction`, `helpedFaction`, `harmedFaction`, `friendFaction`, `enemyFaction`): a step whose name is given adds a faction with that name and its status, so the status paid for lands on the sheet; with no name and no faction, the outcome still reports it. The cohort type's formulas read the gang and expert state only where a cohort declares it, so a homebrew cohort rolls and computes its scale. Claim and upgrade modifiers show only once they're set, `cohorts.boxes` is background, and the Quality upgrades read as upgrades ("Documents quality upgrade") beside the ratings they raise.

## 0.2.0

### Minor Changes

- 72234ec: The hidden `crewType.tag` field is gone: the crew-abilities and operation choices and `crew-advance` read the crew type pick with `picksOf('crew-type')`. The entanglement roll offers its table cell's entanglements as a value choice, and `create-crew` finds its new cohorts through `steps.<id>.added` instead of fixed instance IDs.
