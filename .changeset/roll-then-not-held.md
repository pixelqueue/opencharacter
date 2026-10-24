---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A roll effect's `then` changes are no longer held by a `hold` action step: they record a roll
the used action made, so a held attack whose other changes are never released still ends
Sapped or spends a boon's use, and the effect, marked as fired for the run, isn't left unspent.
