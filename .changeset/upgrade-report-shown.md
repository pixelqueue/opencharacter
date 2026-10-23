---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

The upgrade report's values add `shownBefore` and `shownAfter`: whether the field was shown on
the old sheet and is shown on the new one (computeSheet's `shown`), each present with its side,
so an app can leave hidden or irrelevant values out of "what changed".
