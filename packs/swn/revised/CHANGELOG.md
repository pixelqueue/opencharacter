# @opencharacter/swn-revised

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
- 033d16d: Grant-only content (#172): partial classes and quick-character styles are held only through picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.
- 033d16d: The Psychic and Partial Psychic grant each trained discipline's core technique with one grant over
  the `psychic` family (a technique with `core: true` and that `discipline`), so an add-on's
  discipline gets its own core technique from them.
- 033d16d: Open to add-on packs: skills and psychic disciplines. The core's changes and the Specialist's
  effect name a skill's fields through `fieldId`, so an add-on's skill or discipline (added to the
  `skill` family and `general`, `combat` or `psychic`) is gained, raised and rolled by the core's
  actions. The enums holding a skill or discipline are open: a background's entries, a focus's and
  a weapon's `skill`, `psionics.discipline`, a technique's `discipline`, and the parameters of
  `gain-skill`, `focus-skill-points`, `raise-skill`, `skill-check` and `pick-technique`.

### Patch Changes

- 033d16d: A start's gear ends within the encumbrance limits, not just the push limits. AWN stows Readied
  items past half Strength, readies Stowed gear that fits, then leaves the heaviest Stowed items
  behind. SWN, once gear and spare weapons no longer stow within Strength, stows readied gear, a
  shield, the last weapon and then armor anyway, and leaves the heaviest Stowed items behind.
- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).
- 033d16d: Advancement actions are available only when something is owed: `level-up` when the XP reaches
  the next level, skill improvements (`improve-skill`, `raise-skill`, `learn-technique`) when there
  are skill points or credit to spend, and attribute boosts (`improve-attribute`,
  `boost-attribute`) when the next boost is affordable at the character's level.
- 033d16d: Add-on packs' content joins creation. The equipment packages are content of the new type `kit`, each adding its gear and credits with its own `unpack` action, and a class names its recommended package in the new item field `kit` (the recommendation now follows the class, as intended; it was always the Gunslinger package). The quick tables' class and style are content of the new type `style` (the class, the scores and the column of the quick foci table); a style without a column picks its foci as the full procedure does. The psychic-only and non-psychic foci are told apart by the new tags `needs-psionics` and `no-psionics` instead of by ID.
- 033d16d: Open to add-on packs' values: weapon `ammo`, gear `category` and `kind`, and armor `category`. Steps add-on packs' rules effects reach carry tags: `creation.kit` (the package pick), `creation.focus` and `level-up.focus` (a focus pick), `creation.finish`, `level-up.level`, `rest.night` and `rest.scene`. An option added to the package or focus pick is taken instead of a package or focus.
- 033d16d: Available Effort no longer goes negative when torching lowers the maximum under what is committed: it shows 0, the commitments stay, and the rules issue `effort-overcommitted` reports it until a technique is released.
- 153b36f: `focus-skill-points` finishes `none` for a psychic skill the character can't learn. `psionics.discipline` is an enum with named values (`none` when unset). The headline drops its separator when the class or background is missing. Psychic Succor finishes `failed` on a target whose System Strain can't take it. Starting gear stows readied gear and all but one weapon while they fit, so a weak character starts within the readied limit where the package allows. Rolled hit points are a background value, the committed Effort tiles have short labels, heal's amount reads "Hit points regained", and the discipline prerequisite text names the discipline.
- 033d16d: `gain-skill` and `starting-gear` are available only while the character is being created, and
  the helpers `gain-focus`, `focus-skill-points` and `pick-technique` are no longer listed: creation,
  level-up and Learn a technique run them.
- 033d16d: A weapon's `loaded` state key moves from each magazine weapon to the `weapon` type (its
  magazine, else 0), with name text, so a homebrew weapon with a magazine has it too.
- 033d16d: Torched Effort lasts only for the scene: a technique sustained when only torched Effort is free
  marks that point on its holder (the technique's new `torched` state), and the end of the scene or
  a night's rest releases it, so available Effort no longer drops below 0. Committing torched Effort
  "for the day" commits it for the scene.
