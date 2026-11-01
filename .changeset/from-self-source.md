---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

`from: self` on a roll, choice-step or changes-step effect names the content the action runs
for: besides the copy being the action's entry, an action run for content on the copy (a pick or
grant, with `source`) matches only the effects that content carries. Abilities a class grants
that share their content type's action now each add only to their own runs; before, every
ability on the copy matched, so one ability's bonus reached another's rolls (#199).
