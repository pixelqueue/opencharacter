---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

loadRuleset reports `duplicate-content-id` (data `id`, `pack`) when two content items of one
pack share an ID, instead of keeping the last silently.
