---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A rules action may declare `clock: turn-boundary`: the app runs it on every character in the
encounter at each turn change, with `params.ended` and `params.started` the IDs of the characters
whose turn ended and starts. It must run with nothing the app makes up and never pause (every
parameter defaulted or `optional`, `ended` and `started` strings, no role with a minimum, listed,
no choice, allocate or handoff step in it or a rules action it runs, never on content;
`invalid-clock-action` at load), and computeSheet lists it with its `clock`. Content resets
turn-scoped accumulators through its tagged steps and ends what the creature whose turn starts
applied until then (`self.appliedBy == params.started`) (#198, #187).
