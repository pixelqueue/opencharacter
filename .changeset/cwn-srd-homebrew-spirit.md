---
'@opencharacter/cwn-srd': patch
---

A spirit's summoning cost counts the core spirit's `powers` picks, and for any other spirit the
new `powerCount` item field (default 0), so a homebrew spirit with or without powers computes its
cost instead of failing with `no-such-key`.
