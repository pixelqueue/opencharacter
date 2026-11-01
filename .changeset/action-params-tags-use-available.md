---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
'@opencharacter/text': minor
---

Content extends a shared action per item (#194):

- A `use` entry may have its own `available`, ANDed with the used action's and evaluated with
  the listing's `item` and `self`: a condition's saving throw only while it is "save ends".
- An action's `tags` may hold `{ formula }` entries, evaluated per listing with its `item` and
  `self`; computeSheet's listing (display groups), describeAction and `params` effects see them.
- A new effect op, `params`, on a new target, `{ actions: [<tag>], from? }`, adds parameters to
  the listed actions whose tags match while its `when` holds: an ability's damage type chosen
  on each use, a feature's opt-in on a rules action. startAction checks them as the action's
  own (their errors carry `addedBy`), describeAction lists them after the action's own with
  `addedBy`, and content reads them as `params.<name>` in its effects. Their text is
  `<content key>.params.<name>.name`; the text package adds `addedParam`,
  `addedParamDescription`, `addedParamValue` and the keys `addedParamKey` and
  `addedParamValueKey`, and names a parameter error by `addedBy`.
