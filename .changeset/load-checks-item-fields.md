---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Loading checks content items' `fields` against their content type: a missing required field
(after `extends`), an undeclared name or a value of the wrong shape is the new load error
`invalid-item-field` (data: `item`, `field`, `reason`, `pack`), with a path to the field. A
character's homebrew gets it as `homebrew-error` at `/homebrew/content/<i>/fields/<field>`, so
an app can show it on its custom-item form (#104).
