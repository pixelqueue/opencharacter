---
'@opencharacter/godbound-core': patch
---

The `d20` and `attack` bands test the roll itself (a natural 20, a natural 1, then the total
against the target or 20 less the AC) instead of a derived 0/1/2 value, so a roll's summary
reads "14 or higher" rather than "exactly 1". Band IDs and results are unchanged.
