---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Changes and choice steps give `steps.<id>.added`, the instance IDs of the copies their `addItem` changes add, so later steps can aim at a new copy (#36). A changes step's result is now typed at load.
