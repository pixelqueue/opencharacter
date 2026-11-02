# @opencharacter/godbound-core

## 0.3.0

### Minor Changes

- aae4b97: `attack` drops its manual `maximize` parameter: Unerring Blade and Surge of Strength add their own parameters to the attacks they fit (`unerringBlade`, `surgeOfStrength`), committing the scene's Effort (Unerring Blade also hits on anything but a natural 1), and the weapon's `equipped` and a held gift's Effort gate their `use` entries. `gift-blast`'s `mob` parameter is offered only on gifts with Mob damage. Apps that passed `maximize` to `attack` pass the gift's parameter instead (a `maximize` passed now is ignored), pass `mob` only where `gift-blast` offers it, and no longer find `attack` listed on an unequipped weapon.

### Patch Changes

- 44a8809: The gift type's `effectsWhen` holds a gift held while active to its committed Effort, in place of the `self.committed > 0` guard each such gift's effects repeated. Nothing changes on the sheet.
- aae4b97: Adept of the Gate, the Way and the Throne recommend the first invocation they offer instead of a fixed list, so an add-on pack's invocations are recommended too.
- aae4b97: Unerring Blade and Surge of Strength asked on one attack with Effort for only one commit one Effort and apply one gift, not both. A divine fury saved with no rounds left (`fury.rounds` 0) no longer ends on the first turn boundary; it waits for `end-fury`.
- 44a8809: Defy the Iron is modeled: the `defyTheIron` situational choice, offered while the hero holds the gift and has free Effort, is selected on the damage it negates. The attack's or injury's batch takes no damage, and one Effort is committed for the scene.
- aae4b97: Gifts compute the hero's damage, Mob damage and healing dice (`damage`, `mobDamage`, `healing`, in dice notation at the hero's level), on copies and on the gifts Apotheosis and artifacts grant, and the gift card shows them.
- aae4b97: While Rain of Sorrow is held, a ranged attack offers `mob`: against a Mob, its damage is read straight and adds the level.
- ca525b4: README: Effort and Influence wording; the quick start passes `policy`; the closed #70 citation replaced with the real reason; new Limitations section.
- aae4b97: A `turn-boundary` clock action counts divine fury's rounds down (`fury.rounds`, set to the level) as the hero's turns end and ends the fury after the last. Burning Vitality, used on the hero, heals a hit point at each of those turn ends until at full health.

## 0.2.0

### Minor Changes

- 033d16d: A result band may mark its set's success threshold, `success: true`: the band a roll needs, what
  an app shows before the roll ("what you need"). A set marks at most one. The roll summary
  (`needs.summary`, a log entry's `summary`) and `text.rollTargets` carry the mark on its band; a
  pack's band condition text that needs a test's value no longer shows its raw template when the
  band has no tests. Every pack marks its banded checks, saves and attacks: the DC check's success,
  the attack's hit, Fate's `succeed` against the opposition, FitD's action roll at `partial` (a 4
  or 5 does what the player set out to do), Mothership's success and panic `pass`, Mörk Borg's test
  against the DR. Ladders, tables and fortune rolls have no threshold and mark none.

### Patch Changes

- 033d16d: Armor `weight` is open to add-on packs' values. Steps add-on packs' rules effects reach carry tags: `creation.finish`, `level.gain`, `rest.scene` and `rest.day`.
- 033d16d: Creation's armor and shield picks offer none or any armor and shield of the ruleset (the new hidden set fields `gear.armor` and `gear.shields`), so an add-on pack's gear is offered and drawn too; with the core gear the draws keep their odds.
- 033d16d: The `d20` and `attack` bands test the roll itself (a natural 20, a natural 1, then the total
  against the target or 20 less the AC) instead of a derived 0/1/2 value, so a roll's summary
  reads "14 or higher" rather than "exactly 1". Band IDs and results are unchanged.
- 033d16d: Magical healing and a miracle that mimics a day-committing gift no longer commit Effort the hero
  doesn't have: `heal` with `magical` ends with `no-effort` when no Effort is free, and `miracle`
  with `mimic-day-gift` when fewer than 2 are.
- 153b36f: Commit Effort, Commit Influence and Reclaim Influence bound `amount` by `effort.free`, `influence.free` and `influence.committed`. Prerequisite text names only the requirement ("Adept of the Gate", "Bound to the Word of Fire"). The committed Effort tiles have short labels, and heal's amount reads "Hit points regained".
- 033d16d: Creation offers armor lightest first (light, medium, heavy) and shields by rising bonus, an
  add-on pack's among them, rather than sorted by ID.
- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).
- 033d16d: Name text for every state key: AWN's focus `level`, weapon `shots`, mutation `origin` and
  negative mutation `light` (and the weapon's computed values), CWN's Neural Buffer `bufferUsed`,
  Godbound's gift `artifactEffort`.
