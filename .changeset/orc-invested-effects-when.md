---
'@opencharacter/orc-2e': patch
'@opencharacter/orc-sf-2e': patch
---

Worn and held items with the invested trait work only while worn and invested through one
`effectsWhen` on the `worn` and `held` types, instead of `self.equipped && self.invested` in each
effect's `when`. Grants, kept templates and actions keep their own conditions; armor and runes,
whose base works uninvested, keep theirs per effect.
