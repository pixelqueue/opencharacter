---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
'@opencharacter/text': minor
---

A choice step over values names its values by the content the action runs for first:
`<contentId>.options.<value>.name`, else `<actionKey>.options.<value>.name`. A pause over values
(and its random draws) carries `needs.content`, the content's qualified ID; `text.option` takes
`content` in its context and `describeNeed` passes it, and `pnpm validate` accepts the item's
own value keys. One shared action's values now take per-content text (#72).
