---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Tag targets reach only related packs (#217). Tags aren't qualified, so unrelated games loaded in
one ruleset (the `@opencharacter/packs` bundle, a homebrew mixing games) may share one. An
effect's roll, choice-step, changes-step and action (`params`) targets, and a situational
choice's roll effects, now reach an action only when the pack that wrote the action and the
effect's pack meet over the target tag: their scopes (each pack with its dependencies) share a
pack that declares it. An add-on and its core reach each other's tagged actions, as do two
add-ons of one core and the homebrew; an unrelated game never does, and a shared base pack
connects games only over the tags it declares. An action counts by the pack that wrote it (a
content type's action on a homebrew item is the type's pack's). A `fields` query reaches only
fields of packs whose scopes share a pack with the effect's. The load error
`invalid-added-param` uses the same scope: `declared` counts only actions the effect reaches,
and `conflict` needs one action both effects may reach. Incoming changes carry no pack and stay
unscoped. The ruleset's `packs` entries list each pack's own declared `tags`.
