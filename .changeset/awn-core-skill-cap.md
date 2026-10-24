---
'@opencharacter/awn-core': patch
---

Gaining a skill with every skill at its cap no longer fails with `index-out-of-range`:
`gain-skill` and `gain-benefit` finish with `none`, and `skill-points-toward` with every skill at
level-4 does too, so a background benefit or barred-skill reassignment always finishes.
