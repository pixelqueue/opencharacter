---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Per-target edges and banes, a roll's effective total, and minimum tiers (#190, #192):

- A roll's `atLeast` and `atMost` on its tallies and on its band value hold whenever it is
  classified again (`of`): before, a minimum tier or a tally cap was lost on the per-target
  bands.
- A roll step that classifies an earlier roll again (`of`) may carry `tags` of its own. The roll
  effects matching them work out its tallies and bounds again from the earlier roll's, in the
  step's context (`participant` bound in an `each` step), so what one target brings to a roll
  (an edge against a prone or winded target) reaches only that target's band, and the roll's
  tally bound (ignoring banes) applies after it. Their `then` is proposed as on a roll step. The
  log entry lists the step's `tallies` and own `bounds`. Effects that add items or dice don't
  apply there, so per-target advantage isn't covered.
- A band set may give `total`, the roll's effective total: evaluated first, it becomes the
  step's `total` (and `roll.total` for the set's `value` and bands), so a roll with an edge
  reports 15, not 13. The total before it is the new `steps.<id>.bounded`, and the log entry's
  `bounded` when they differ. A set needs `value`, `total` or both.
- `atLeast` and `atMost` roll effects aimed at a band set's value (`target: { rolls, band:
  value }`) bound a numeric `value` before the bands read it: a minimum tier. The log entry lists
  them in `bandBounds`. `pnpm validate` warns when a matching roll's band set has no `value`.

The docs also show costs that depend on the roll: a `changes` step after it, with `available`
reading the lowest cost and an `outcome` step ending an action whose cost can't be paid (after
the roll's dice and its effects' `then`).
