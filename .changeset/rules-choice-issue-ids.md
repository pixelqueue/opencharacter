---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
'@opencharacter/text': minor
---

A rules-level choice's issue IDs name its pack (#213): `choice-not-applicable`, `too-many-picks`,
`too-few-picks`, `option-not-eligible`, `already-picked`, `no-eligible-option` and
`picked-copy-invalid` carry `<pack>:rules/<choice>` (was `rules/<choice>`), the owner as
`needs.choice.owner` names it, and an inline option of a rules-level choice has the source ID
`<pack>:rules/<choice>/<option>`, so its prerequisite, immunity and nested choice IDs are
qualified too. `@opencharacter/text` reads the choice's prompt from the pack the ID names instead of
searching the loaded packs. A breaking change for an app that keys on `rules/<choice>`.
