---
'@opencharacter/draw-steel-heroes': patch
---

Healing Grace and Prayer Effect find the conditions they end by `item.id` instead of `self.source`, which an applied entry doesn't have, so standing up and ending an effect no longer fail when applied.
