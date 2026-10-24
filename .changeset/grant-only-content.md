---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Grant-only content: a content type or an item may say `grantOnly: true`, content held only
through grants and picks (a class feature, a subclass, an ancestry trait). `addItem` of it, in
an app's batch or an action's proposed changes, is the new runtime error `not-addable` (data:
`item`; standard text in `i18n/en.yaml`); grants and choices take it as before. An item's own
`grantOnly` replaces its type's, and homebrew items follow their type. The loaded ruleset gives
each item the value that applies (`content.<id>.grantOnly`), so apps leave it out of add-item
catalogs. `pnpm validate` reports a proposed `addItem` of grant-only content (#172).
