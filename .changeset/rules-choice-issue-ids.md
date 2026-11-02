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
qualified too. Competing-option IDs move with them: a rules-level choice's own effects are
`<pack>:rules/<choice>#<pick>/<effect>` (was `rules/<choice>#…`) and its inline options'
`<pack>:rules/<choice>/<option>#<effect>` (orc-2e's `qi-tradition`:
`orc-2e:rules/qi-tradition/divine#0`), so an app re-keys the competing picks it saved (in
`extensions`) under the old IDs. `@opencharacter/text` reads the choice's prompt from the pack the ID names instead of
searching the loaded packs. A breaking change for an app that keys on `rules/<choice>`.
