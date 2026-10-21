---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

An `applied` incoming-change effect may carry `then`, and `then` may remove the effect's own applied entry (`{ type: removeEffect, entry: self }`), for effects that end when they trigger (#17).
