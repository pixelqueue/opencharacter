---
'@opencharacter/mork-borg-core': minor
---

Open to add-on packs: a weapon's `ammo`, ammunition's `kind` and a scroll's `kind` are open
enums, and creation's choice and changes steps carry `creation.*` tags for an add-on's options
and changes. The guided start follows a picked weapon with ammunition by a pick among the
ammunition of its kind (`ammoPick`), so an added kind is found. A class's new `brews` field (the
Occult Herbmaster's) shows the decoctions group, instead of a check of the Herbmaster's ID.
Speaker of Truths' clarity is one effect that ends itself on the test's roll, now that an
effect's `then` runs once per action.
