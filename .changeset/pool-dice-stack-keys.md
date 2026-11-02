---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

`poolDice` roll modifiers stack by key (#214): those on one part are grouped by `stackKey` and
reduced by the key's policy, compared by `count`, as `stepDie` modifiers are by `steps`. Under
`highestOnly` only the largest pool counts, so Sine Nomine's skill dice from two foci no longer
add up. A pack whose keyed pool dice used a non-`addAll` policy now rolls fewer dice.
