---
'@opencharacter/text': patch
---

A tag the item's pack doesn't name, such as a core's keyword on an add-on's ability, is named by the pack that declares it instead of showing its raw ID: through the item pack's dependencies first, given `scopes` (`ruleset.packs`), then any other pack (#281).
