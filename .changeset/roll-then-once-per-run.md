---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A roll effect proposes its `then` at most once per action run: a reroll, or a second roll the effect changes in the same run, no longer proposes a second `removeEffect` (which applyChanges rejected) or spends a second use.
