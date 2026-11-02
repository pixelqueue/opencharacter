---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Auras from casts, and auras that grant immunity.

- An aura may say `scope: applied` (#229): it is projected by applied entries of its item instead
  of by the held item. computeSheet lists it once per active, unblocked applied entry the
  character applied itself (no `appliedBy`, or its own `id`), with `entry` that entry's ID, and
  its `when` and `size` see the entry as `self`. So one cast is one aura, whatever it was cast
  from, sized by the cast's own state, and it leaves `auras` when the entry ends.
- Content an applied grant reaches sees its own declared state defaults in `self` for keys the
  granting entry lacks.
- An aura whose `when` or `size` fails is left out of `auras` with the formula's error, no longer
  silently.
- An aura may declare `immuneTo` (#227), the immunities of its entry: a matching applied entry on
  whoever is inside is blocked and reported `immune` with the ID `<item>#<aura>/<id>`. Its `when`
  and query `where` see `item`, `self` and `applier`. A `scope` other than `applied` on one is
  `invalid-aura`, as is an aura with neither `effects` nor `immuneTo`.
