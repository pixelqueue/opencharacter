# @opencharacter/godbound-core

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
