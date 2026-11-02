---
'@opencharacter/wwn-srd': patch
---

Unarmed Combatant, Natural Weaponry and Unarmed Might set the unarmed die, Shock and Shock AC under one spanning stack key (`unarmed`, `playerChooses`, scored by the die): the character takes all three from the one source picked, the best die recommended. Before, each field was its own competing group, so a sheet could take one source's die and another's Shock AC.

App state: the competing groups on the unarmed die, Shock and Shock AC are now one `unarmed` group spanning the three fields, with one option per source, so a pick an app saved for the old per-field groups has to be made again.
