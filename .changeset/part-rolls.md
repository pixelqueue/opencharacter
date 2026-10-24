---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
'@opencharacter/text': minor
---

Advantage and disadvantage reach a roll's parts: with a `parts` target and `of: roll`, the
matching parts' items are rolled again as a group and the better or worse total kept, the roll's
other items rolled once (5E's Savage Attacker: the weapon's dice, not Sneak Attack's). Part
sources are counted apart from the roll's own; a roll made again whole adds none. A dice pause's
`repeat` gains `items`, the items rolled again, and `text.dice` words them together:
"(2d6, rolled twice, keep the higher total) + 3d6" (`dice.grouped`) (#71).
