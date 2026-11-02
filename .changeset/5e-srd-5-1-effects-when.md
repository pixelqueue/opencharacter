---
'@opencharacter/5e-srd-5.1': patch
---

Magic items that need attunement have their effects only while attuned through `effectsWhen` on the `magicItem` type (and on each template that needs attunement), instead of a `self.attuned` check in every effect. Sheets compute the same.
