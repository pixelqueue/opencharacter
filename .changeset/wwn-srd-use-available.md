---
'@opencharacter/wwn-srd': patch
---

`attack` asks whether the weapon is thrown only for throwable weapons; any other weapon's `use` fixes `thrown: false`. An art lists `commit-effort` only when it commits Effort and `release-effort` only when its Effort is ongoing, through `available` on the art type's `use` entries instead of type tests in the shared actions.
