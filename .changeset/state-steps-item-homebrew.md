---
'@opencharacter/spec': patch
'@opencharacter/engine': patch
---

`renameState` with `item` no longer renames the key on every homebrew item: in the homebrew, and on saved copies, `renameState`, `removeState` and `moveState` with `item` apply to that item and homebrew items that extend it (with `type`, both must match). `renameChoice`'s `from` and `to` may be prefixed choice keys (`<qualified id>/<choice>`), moving a granted or template content's saved pick onto its owner's own choice. Upgrade docs and the upgrade schema describe every step parameter.
