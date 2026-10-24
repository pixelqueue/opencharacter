---
'@opencharacter/fitd-crew': minor
---

`crew-advance` spent on an ability, with a crew type, asks only the type's `special-ability` choice, not every other pending choice (its `operation`, the Rigging's kinds). The hidden `crewType.id` field is gone: the rules read whether a crew type is picked from the saved picks.
