---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

An action (or a `use`) may say `listed: false`: computeSheet leaves it out, but an `action` step
with `source` or `entry` still runs it while its `available` holds, and so does `startAction`.
Content can now add its own part to a shared rules action without a button of its own (#81).
