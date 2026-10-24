---
'@opencharacter/mork-borg-core': minor
---

A Speaker of Truths' clarity and the Horn of the Schleswig Lords' blare are applied content of the new `boon` type (`boons.clarity`, `boons.horn`) instead of the input fields `tests.truth` and `tests.horn`: `speak-truth` and `blow-horn` apply them to the recipient, and each ends itself on the test it changes (a roll effect's `then`), so `test` no longer proposes clearing a flag. Clarity is +4 to the roll (the outcome's `total` carries it, `dr` doesn't), kept on an omen's reroll; the blare is the roll tally `horn`, which makes the test a success (a crit stays one, a natural 1 succeeds). The upgrade drops the old flags.
