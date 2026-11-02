---
'@opencharacter/orc-2e': patch
'@opencharacter/orc-sf-2e': patch
'@opencharacter/spec': patch
---

A Strike's critical hit tags the damage it deals `damage.critical`, as a spell attack's already
does, so a reaction to a critical hit (Scars of Steel) is offered on it. `orc-scars-of-steel`
now routes a real critical Strike's damage.
