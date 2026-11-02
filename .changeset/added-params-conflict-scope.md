---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

`invalid-added-param` (`conflict`) follows the effects again, not only the actions loaded so far
(#222). Two `params` effects adding one name with other declarations conflict when their target
tags meet (one is the other or below it) and their packs meet over that tag, or when one action's
literal tags reach both. So two add-ons of one core, or two effects of one pack whose action gets
the tag only from a formula, are rejected again (#224 accepted them when no loaded action carried
the tag literally); an unrelated game loaded beside them, or a pack depending on two games, still
never clashes. Two `from: self` effects carried by different content items don't conflict, so
each spell may declare its own values for one `damageType` parameter on the shared cast action,
unless one item names both (itself, its `grants`, its choices' `items` and inline options) and has
an action, its own or its type's, that both reach: its copy's own run takes both. A
breaking change for packs that declared one name otherwise over tags that meet.
