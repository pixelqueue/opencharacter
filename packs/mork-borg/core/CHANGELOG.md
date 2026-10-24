# @opencharacter/mork-borg-core

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
- 033d16d: Creation is open to add-on packs. The `class` start draws the class among the classes offered (`random`, a d6 over the core six) instead of indexing a d6 into them, and each class feature is drawn among the class's options (the Royalty's second a d5 over the five left, drawn rather than counted on from the first), so an add-on class and its features come up in random starts. A feature that brings a weapon grants it into the hidden `features.weapons` (the weapon is `fromFeature`, off the starting table) and creation adds it, instead of a list of the core options. The guided start offers each item the starting tables give as a pick among its type's content, add-on gear included, recommending the table's; the random starts keep the book's tables. The `classRoll`, `feature` and `feature2` steps are gone.

  A class's new `startingScroll` field (the Esoteric Hermit's) gives it the random starting scroll, instead of a check of the Hermit's ID.

- 033d16d: A Speaker of Truths' clarity and the Horn of the Schleswig Lords' blare are applied content of the new `boon` type (`boons.clarity`, `boons.horn`) instead of the input fields `tests.truth` and `tests.horn`: `speak-truth` and `blow-horn` apply them to the recipient, and each ends itself on the test it changes (a roll effect's `then`), so `test` no longer proposes clearing a flag. Clarity is +4 to the roll (the outcome's `total` carries it, `dr` doesn't), kept on an omen's reroll; the blare is the roll tally `horn`, which makes the test a success (a crit stays one, a natural 1 succeeds). The upgrade drops the old flags.
- 033d16d: `get-better` runs a class's own part of getting better: a class with the new `getsBetter` field has an unlisted `get-better-part` action (the Gutterborn Scum's second specialty), so a homebrew class can add one. The Scum's steps are at `classPart/specialty` and `classPart/second`, after a `class` choice.
- 033d16d: Open to add-on packs: a weapon's `ammo`, ammunition's `kind` and a scroll's `kind` are open
  enums, and creation's choice and changes steps carry `creation.*` tags for an add-on's options
  and changes. The guided start follows a picked weapon with ammunition by a pick among the
  ammunition of its kind (`ammoPick`), so an added kind is found. A class's new `brews` field (the
  Occult Herbmaster's) shows the decoctions group, instead of a check of the Herbmaster's ID.
  Speaker of Truths' clarity is one effect that ends itself on the test's roll, now that an
  effect's `then` runs once per action.
- f44f66c: `create-character` puts the starting equipment on the sheet: the waterskin and d4 days of food, and what the three equipment tables give, as copies of the pack's scrolls, decoctions and shield or of the new `equipment` type (names only, with the tables' numbers; counted by `load.items` unless a beast or vehicle). The tables are rolled before the weapon and armor, so a classless character with a scroll from them gets the smaller dice: the `scroll` parameter is gone, and the outcome no longer carries the rolls as data. The classless start draws its two 4d6 abilities at random instead of always Strength and Agility.

### Patch Changes

- 033d16d: Applied boons (Speaker of Truths' clarity, the horn's blare) show on the sheet in a Boons group until they end.
- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).

## 0.1.1

### Patch Changes

- 72234ec: Creation no longer gives the class and companion copies fixed instance IDs: it asks the new class's features through `steps.class.added`, and getting better finds the Gutterborn Scum's copy with a copies choice. The Herbmaster's dose split is a value choice, and creation and brewing name their weapons, armor, ammunition, scrolls and decoctions with `@` refs instead of building ID strings.
