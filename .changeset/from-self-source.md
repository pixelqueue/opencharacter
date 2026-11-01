---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

`from: self` on a roll, choice-step or changes-step effect names the content the action runs
for: besides the copy being the action's entry, an action run for content granted or picked
under the copy (named by `source`) matches only the effects that content carries. Abilities a
class grants that share their content type's action now each add only to their own runs;
before, every ability on the copy matched, so one ability's bonus reached another's rolls
(#199). So an effect on the copy's own item (a class) or in a choice's own `effects` no longer
reaches the actions of content granted or picked under it. A template is part of its copy: its
own action still matches by entry, so the copy's item, type and other templates reach it.
