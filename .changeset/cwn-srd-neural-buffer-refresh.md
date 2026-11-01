---
'@opencharacter/cwn-srd': patch
---

A Neural Buffer's phantom hit points refresh: the buffer has an hourly action ("An hour passes") that refreshes them, and a night's rest does too. Before, `bufferUsed` never reset.
