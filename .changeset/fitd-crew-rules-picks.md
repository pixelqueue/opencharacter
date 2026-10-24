---
'@opencharacter/fitd-crew': minor
---

The hidden `crewType.upgrades` and `crewType.claims` fields are gone: the special-upgrades and
allied-claims constraints, the special upgrades' display hints, the crew advance's upgrades and
the claim steps read the picked crew type's `upgrades` and `claims` with `itemField` over
`picksOf('rules', 'crew-type')`.
