---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
'@opencharacter/text': minor
---

Inline options as content items (#195): an inline option may have an optional description,
`<owner>.choices.<choice>.options.<id>.description` (Markdown), so a random table of named
paragraphs is a choice of inline options, and `createText`'s new `optionDescription(choice, id)`
reads it (from the adding pack for an option `extendChoices` added). An inline option takes
`immuneTo`, held while it is picked and active; the `immune` issue's `id` is the option's source
ID plus the immunity's (`<owner>/<choice>/<option>/<id>`).
