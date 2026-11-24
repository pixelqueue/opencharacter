---
'@opencharacter/engine': patch
'@opencharacter/spec': patch
---

Fixes found building an add-on pack (#281). An `action` effect's `params` and `participants` see the running action as `action`. `fieldId` in an effect's `{ formula }` target names a derived field. A pack release without `rules` or `content` is `invalid-shape` instead of a thrown TypeError. A role's or slot's `fields` naming a set the pack doesn't declare is always `invalid-family`, and so is a `viewFields` set named with a pack: sets are the declaring pack's own. The checker types `self` in an `applied`, `picks` or `grants` query as the entry's real shape, and an effect's `participant` and `participants` as the views roles declare, so a key the run can't read is `unknown-name` at load. checkRelease reports the previous release's formula errors as `warnings` (a stricter checker than the one it was published under) and still compares it with its fix. Spec: the docs say so, with conformance cases for each.
