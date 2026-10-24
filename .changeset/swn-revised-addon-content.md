---
'@opencharacter/swn-revised': patch
---

Add-on packs' content joins creation. The equipment packages are content of the new type `kit`, each adding its gear and credits with its own `unpack` action, and a class names its recommended package in the new item field `kit` (the recommendation now follows the class, as intended; it was always the Gunslinger package). The quick tables' class and style are content of the new type `style` (the class, the scores and the column of the quick foci table); a style without a column picks its foci as the full procedure does. The psychic-only and non-psychic foci are told apart by the new tags `needs-psionics` and `no-psionics` instead of by ID.
