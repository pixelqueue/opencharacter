---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

startAction reports a situational choice the app selects that the ruleset doesn't declare as the
new action error `unknown-situational` (data `situational`) instead of ignoring it, so an app
notices a choice a pack update removed (#220).
