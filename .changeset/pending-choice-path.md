---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A choice step over pending choices may take `pending: { path }`, a choice path as a `choose`'s:
only the pending choices at it or under it are asked, so a crew advance asks the abilities of
the picked crew type without every other pending choice (#74).
