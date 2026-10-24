---
'@opencharacter/swn-revised': patch
---

Available Effort no longer goes negative when torching lowers the maximum under what is committed: it shows 0, the commitments stay, and the rules issue `effort-overcommitted` reports it until a technique is released.
