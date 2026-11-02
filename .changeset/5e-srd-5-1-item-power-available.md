---
'@opencharacter/5e-srd-5.1': patch
'@opencharacter/spec': patch
---

A magic item's power that is out of charges or used since dawn isn't offered: each `use: item-power` that spends charges has `available: self.charges >= <n>` on the use, and the Rod of Lordly Might's and the Staff of Thunder and Lightning's once-per-dawn properties check `usedToday` in their actions' `available`. Conformance suite: `5e-rod-of-lordly-might-used` expects `unknown-action`.
