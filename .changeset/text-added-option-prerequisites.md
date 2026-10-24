---
'@opencharacter/spec': patch
'@opencharacter/text': patch
---

A `prerequisite-not-met` on an inline option another pack added to a choice (`extendChoices`)
reads the requirement and the option's name from the adding pack's text, found through
`optionOrigins`, when the owner's pack has none.
