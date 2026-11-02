---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A `params` effect may add bounds to a parameter the run already has: an entry with only `min`
and/or `max` (no `type`) bounds the action's own parameter, or one another effect adds, instead
of declaring it. Every bound must hold; the `out-of-range` error names that parameter, with the
failing bound's `min` and `max` and `boundBy`, the content that added it. describeAction lists
them under the parameter's `addedBounds`. Two bounds on one name don't conflict; a bound on a
name no action declares and no effect adds is `invalid-added-param` (reason `undeclared`). So
Healing Grace's enhancements bound the ability's own `spend`, and an overspend names `spend`
(#252).
