---
'@opencharacter/orc-2e': patch
'@opencharacter/orc-sf-2e': patch
---

A held feat carries the holder's class DC and spell DC as computed values (#201): `classDc` (a
class feat's own class's, and an archetype feat's its archetype's class's) and `spellDc`.
Feat descriptions that say "your class DC" or "your spell DC" show the number when an app fills
them (`{self_classDc}`, `{self_spellDc}`), and read as before otherwise.
