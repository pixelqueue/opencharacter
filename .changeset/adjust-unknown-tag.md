---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

applyChanges rejects an adjust whose tag no loaded pack declares: `unknown-tag` (data: `tag`,
path `/changes/<index>`), the batch unapplied. Before, the change applied and the tag matched
nothing, so a misspelled or qualified tag (`<pack>:damage.fire`; tags are never qualified)
silently fired no incoming effect or follow-up (#186).
An app applying changes to a linked character must load a ruleset that declares the tags it
sends.
