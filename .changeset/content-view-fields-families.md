---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

A view-field set's family keys expand where the set is declared, so a content action's
participant role that names the set gets the expanded fields, as a rules action's role does.
Before, the role kept the unexpanded keys and loadRuleset failed with `unknown-name` on a formula
reading one (#183).
