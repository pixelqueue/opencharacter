---
'@opencharacter/orc-2e': patch
'@opencharacter/orc-sf-2e': patch
'@opencharacter/spec': patch
---

A failed check (`check`: skill actions, Perception, saves) offers a Hero Point reroll after the
roll: a `check.reroll` choice step whose option the rules add while the character has a Hero
Point, paying it in its `changes`. Declining is recommended, so an automatic run doesn't pause;
the second roll (`rerolled`) stands. Spell Devourer reads the result that stands. Conformance
suite: `orc-check-hero-point-reroll`; failed-check cases log the declined choice.
