# @opencharacter/fitd-crew

## 0.3.0

### Minor Changes

- 033d16d: Open to add-on packs. The gang types are a family (`gang`), so an add-on adds one with its
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
- 033d16d: `crew-advance` spent on an ability, with a crew type, asks only the type's `special-ability` choice, not every other pending choice (its `operation`, the Rigging's kinds). The hidden `crewType.id` field is gone: the rules read whether a crew type is picked from the saved picks.
- f44f66c: A crew type's `startingCohort` is an enum of the five gang types or `none` (the default), so a custom crew type can't name a gang type that doesn't exist. `create-crew` takes the factions' names as params (`groundsFaction`, `helpedFaction`, `harmedFaction`, `friendFaction`, `enemyFaction`): a step whose name is given adds a faction with that name and its status, so the status paid for lands on the sheet; with no name and no faction, the outcome still reports it. The cohort type's formulas read the gang and expert state only where a cohort declares it, so a homebrew cohort rolls and computes its scale. Claim and upgrade modifiers show only once they're set, `cohorts.boxes` is background, and the Quality upgrades read as upgrades ("Documents quality upgrade") beside the ratings they raise.
- 033d16d: The hidden `crewType.upgrades` and `crewType.claims` fields are gone: the special-upgrades and
  allied-claims constraints, the special upgrades' display hints, the crew advance's upgrades and
  the claim steps read the picked crew type's `upgrades` and `claims` with `itemField` over
  `picksOf('rules', 'crew-type')`.
- 033d16d: Grant-only content (#172): crew types, crew abilities, favored operations and cohort edges and flaws are held only through their picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.

### Patch Changes

- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).

## 0.2.0

### Minor Changes

- 72234ec: The hidden `crewType.tag` field is gone: the crew-abilities and operation choices and `crew-advance` read the crew type pick with `picksOf('crew-type')`. The entanglement roll offers its table cell's entanglements as a value choice, and `create-crew` finds its new cohorts through `steps.<id>.added` instead of fixed instance IDs.
