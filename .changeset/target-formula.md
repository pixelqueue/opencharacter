---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

An effect's `target` may be a string formula naming a field, `{ formula }`, evaluated as an
activation condition when the effect becomes active (`self`, `item`, `pick`, `slot`, the
character functions and input fields), so one value choice's effects reach the field its pick
names: `target: { formula: "'skills.lore.' + pick.value + '.granted'" }`. The effect is then as if
written with that field. An empty string targets nothing; a field that doesn't exist, or one the
op doesn't take, is a sheet error (`unknown-field`, `type-mismatch`) (#79).
