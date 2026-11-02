---
'@opencharacter/5e-srd-5.1': patch
'@opencharacter/spec': patch
---

When concentration ends, the new required follow-up `concentration-ends` ends the caster's concentration spells on every creature holding one (`removeEffect` `to: applied`, by the entries' `appliedBy`; entries saved without an applier stay the app's). Conformance suite: `follow-up-clear` expects it after a lost concentration check.
