---
'@opencharacter/swn-revised': patch
---

Choices that recommended a fixed option now fall back to the first eligible one (`options[0]`) when it's taken: a second Specialist no longer recommends Fix again, an Adventurer who took Partial Warrior first is recommended Partial Expert, and Wild Psychic Talent's picks recommend another technique when theirs is out of reach, so guided runs over these choices don't stop.
