---
'@opencharacter/fate-core': minor
---

A custom stunt's skill, action, limit, uses and fate point cost are its copy's own values of the stunt fields (`perCopy`), set with `setField`, instead of state keys: every reader reads `item.limit` for a custom stunt as for an SRD one. The upgrade moves saved values to the copy's fields.

`skill-roll`'s three copied reroll steps are one `group` step, `rerolling`, of up to three passes: its steps are at `rerolling[<n>]/reroll`, `rerolling[<n>]/rerollFrom` and `rerolling[<n>]/again` (they were `reroll`, `reroll2`, `reroll3` and so on), each with one text key.
