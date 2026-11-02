---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

A proposed `unchoose` may name a content's choice by its owner, `choice: { owner, id }`, instead of
`path` (#233): it clears the choice on every activation of the content, as `picksOf(owner, id)`
reads them, proposed as one path-form `unchoose` per activation whose choice has picks. `owner` is
`self` (the content carrying the effect that adds the change, else the action's or follow-up's
content) or a content ID. Only for the actor's own choices. So content picked anywhere in the
choices tree resets its own pick from a step (Draw Steel's Eidetic Memory at a respite). Apps still
receive path-form unchooses only.
