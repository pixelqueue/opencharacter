---
'@opencharacter/draw-steel-heroes': patch
---

Healing Grace and Prayer Effect find the conditions they end by `item.id` instead of `self.source`, which an applied entry doesn't have, so standing up and ending an effect no longer fail when applied. The engine's checker now refuses 0.1.1 at load (`unknown-name` on `self.source`): use this release, or load 0.1.1 with the build's checks skipped (`prechecked`).
