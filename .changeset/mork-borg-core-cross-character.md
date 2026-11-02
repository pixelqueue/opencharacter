---
'@opencharacter/mork-borg-core': minor
'@opencharacter/spec': patch
---

mork-borg-core (breaking: situational choices are removed or changed): homebrew that reads `situational.omenDamage`, `situational.teeth` or `situational.invisible` no longer loads, and an app that passes them has them ignored. `grace` is now an enum, not a boolean, offered only while a Grace for a Sinner boon is held.

What apps must change:
- **Maximum damage:** instead of `situational.omenDamage` or `situational.teeth`, answer the `maximum` choice that `attack` and Coward's Jab ask after a hit (`roll`, recommended; `omen`; `tooth`). Under an automatic policy the damage is rolled.
- **Scrolls:** pass the one creature a Grace for a Sinner or Metzhuotl Blind Your Eye is read on as `use-power`'s `target` participant (the reader itself, to take it), and apply the proposed `applyEffect` to that sheet. That replaces `situational.invisible` and the old boolean `grace`.
  - `boons.unseen`: +6 on attack and defense for its rounds, or until the holder takes damage.
  - `boons.grace`: its rolled bonus on one roll. The holder picks the roll with `situational.grace: test` or `damage`; that roll ends it.
- **Rounds:** run the new `turn-boundary` clock action on every character at each turn change. It counts down applied entries that last rounds as their applier's turn starts.
- **Poltroon:** apply the jester sheet's `capering` aura entry to those fighting beside it. `poltroon` (the owner) and `poltroonAlly` (others) stay for characters the aura isn't on. They are no longer offered while a capering entry is held, or to the owner while a linked jester is at 0 HP.

Also:
- Coward's Jab is offered by the weapon type's `use` entry (`available`).
- A scroll's card shows the reader's Presence on its duration (a computed `durationBonus`, left out at 0).
- Backlash, infection and hunger roll their dice tagged `damage.direct`, below `damage`, so effects on `damage` rolls still reach them and only Grace's damage bonus leaves them out by name.

No saved shape changes. Conformance cases for each.
