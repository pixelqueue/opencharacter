---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Two upgrade steps (#200). `grantsToCopies` (`item?`, `type?`) turns content a copy's item or type
granted it directly, and no longer grants, into copies of their own right after it, with the
grants' saved state, `state` values, picks and the saved state of what they grant in turn. It
reads old IDs through the script's renames, handles each holder's grants once per upgrade, and
reports content it can't copy as `grant-not-copied` in the upgrade report's `errors`.
`changeContentType` (`id`, `from`, `to`) covers an item's `content-type-changed`: its copies move
to the list the new type keeps them in, lose `equipped` where it isn't equippable, and keep the
state keys the item declares now. checkRelease reports a new shape change, `grant-removed` (a
remaining item stops granting content it granted, covered by `grantsToCopies` or
`removeContent`), and `upgrade-step-mismatch` for a `changeContentType` whose types aren't the
item's.
