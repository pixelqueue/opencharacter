---
'@opencharacter/fate-core': minor
---

A custom stunt's skill, action, limit, uses and fate point cost are its copy's own values of the stunt fields (`perCopy`), set with `setField`, instead of state keys: every reader reads `item.limit` for a custom stunt as for an SRD one. The upgrade moves saved values to the copy's fields.
