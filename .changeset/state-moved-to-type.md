---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

`checkRelease` no longer reports `state-removed` for an item's state key that the item's content
type declares in the new release with the same type: its copies keep their saved values. A pack
may move a key to the type, to open its enum to add-on packs.
