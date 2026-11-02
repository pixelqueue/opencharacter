---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Follow-ups can react to another character's events. A successful applyChanges that made field entries (adjusted a
field) returns `observe`: an `observe` change naming the character, its field entries (with tags
and who sent them) and the applied entries it held that name an applier. Applied to another
character, the new `observe` change changes nothing but fires its `on` follow-ups with `from`:
`any` (any other character), `applied` (one holding an entry this character applied) or
`{ link }` (the character filling a slot); `change.character` and `change.applied` name the
observed character and the content it holds from this one. computeSheet lists the fields such
follow-ups watch in `observes`, so an app routes `observe` only where it matters; an app that
doesn't route events loses only these reactions. A follow-up may also be `to: character`, for the
character whose ID its `character` formula gives (`change.from`): stored and listed here with the
ID in `character`, its changes resolved in this pack's scope (#187).
