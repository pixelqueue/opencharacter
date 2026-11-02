---
'@opencharacter/godbound-core': minor
---

`attack` drops its manual `maximize` parameter: Unerring Blade and Surge of Strength add their own parameters to the attacks they fit (`unerringBlade`, `surgeOfStrength`), committing the scene's Effort (Unerring Blade also hits on anything but a natural 1), and the weapon's `equipped` and a held gift's Effort gate their `use` entries. `gift-blast`'s `mob` parameter is offered only on gifts with Mob damage. Apps that passed `maximize` to `attack` pass the gift's parameter instead (a `maximize` passed now is ignored), pass `mob` only where `gift-blast` offers it, and no longer find `attack` listed on an unequipped weapon.
