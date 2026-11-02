---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Paying to improve a finished roll (part of #192): a choice step's `recommend` may name `#done`
while it is offered, so declining is the default and an automatic run doesn't pause on a step
offering only added options; a written option list may be empty (`options: []`), so such a step
offers only what `option` effects add and is skipped when nothing does. The docs show the
pattern: a tagged step after the roll where content (Draw Steel's Brawny, PF2e's Hero Points,
5E's Lucky) adds a paid option that sets a flag the outcome reads.
