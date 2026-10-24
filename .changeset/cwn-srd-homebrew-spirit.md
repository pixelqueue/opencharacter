---
'@opencharacter/cwn-srd': patch
---

A spirit's summoning cost counts its `powers` picks only when its item has that choice (the new
`hasPowers` item field, set on the core spirit), so a homebrew spirit without it costs 1 instead
of failing with `no-such-key`.
