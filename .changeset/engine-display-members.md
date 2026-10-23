---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

computeSheet lists the members of actions and content groups: `groups[].actions` (indices in
`actions` its `where` matches) and `groups[].items` (activations or applied entries, sorted by
`sectionBy`, then `sortBy`, then instance order, each with its `section`). Each activation's
`hiddenState` names its state keys not shown (`hidden`, or a state hint's `showWhen` false), so
apps evaluate no display formula themselves.
