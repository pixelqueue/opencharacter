# @opencharacter/mothership-1e

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
- 033d16d: Open to add-on packs: a weapon's `woundType` and a class's `trauma` are open enums, and creation's
  class, skills and kit steps (`creation.class`, `creation.skills`, `creation.kit`) and the step
  saving the rolls (`creation.save`) are tagged for an add-on's options and changes. A skill's new
  `towardMaster` field marks the skills on the way to a Master skill, which the Scientist's Expert
  and first Trained picks offer, instead of a list of skill IDs.
- 033d16d: `wound-roll`'s `woundType` parameter is an open enum, so an add-on's wound type is rolled as the
  core's are. The roll finishes with the result `rolled` and the type in its data (`woundType`),
  in place of one result per wound type.
- f44f66c: Taking the class loadout at creation sets the new input field `loadout.owed` ("Class loadout owed") on the sheet instead of returning `loadout` as outcome data, so an app or a gear pack knows the loadout is still to be added. The random start draws each skill pick over the eligible skills instead of always the first.

### Patch Changes

- 033d16d: The random start draws the class over every class offered (a d4 with the core four), so an add-on pack's class can come up; the Android's and the Scientist's stat is asked with the class's other choices, from the class's own choice, instead of by class ID.
- f44f66c: Skill prerequisite texts name only the requirement ("Botany or Geology"), with no "Requires" and no period, for the standard text to wrap with the skill's name.
- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).

## 0.1.1

### Patch Changes

- 72234ec: Shore leave at an X-class port rolls the conversion with `advantage, of: roll` instead of a second roll step, and `roll-character` finds the new class copy through `steps.class.added` instead of a fixed instance ID.
