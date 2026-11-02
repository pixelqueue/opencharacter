---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A parameter's `min` and `max`, an action's own and those a `params` effect adds, see `params`:
startAction checks every bound once every parameter has its value (the app's, a `use`'s fixed
one, or the default), so one parameter bounds another (Healing Grace's enhancements up to the
Spend: `max: params.spend - (params.graceStand ? 1 : 0)`). describeAction leaves out a bound that
reads `params` (#235).
