# @opencharacter/fitd-crew

## 0.2.0

### Minor Changes

- 72234ec: The hidden `crewType.tag` field is gone: the crew-abilities and operation choices and `crew-advance` read the crew type pick with `picksOf('crew-type')`. The entanglement roll offers its table cell's entanglements as a value choice, and `create-crew` finds its new cohorts through `steps.<id>.added` instead of fixed instance IDs.
