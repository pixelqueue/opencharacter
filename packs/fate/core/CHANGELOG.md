# @opencharacter/fate-core

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
- 033d16d: Open to add-on packs: creation's stunt picks (`creation.stunts`) and last step
  (`creation.finish`), and a milestone's benefit (`milestone.benefit`) and new stunt
  (`milestone.stunt`) carry tags for an add-on's options and changes. The README's "Add-on packs"
  section says what a setting pack adds and what stays closed.
- 033d16d: A custom stunt's skill, action, limit, uses and fate point cost are its copy's own values of the stunt fields (`perCopy`), set with `setField`, instead of state keys: every reader reads `item.limit` for a custom stunt as for an SRD one. The upgrade moves saved values to the copy's fields.

  `skill-roll`'s three copied reroll steps are one `group` step, `rerolling`, of up to three passes: its steps are at `rerolling[<n>]/reroll`, `rerolling[<n>]/rerollFrom` and `rerolling[<n>]/again` (they were `reroll`, `reroll2`, `reroll3` and so on), each with one text key.

- 033d16d: `skill-roll`'s dice show what the roll needs when the opposition is known before them: the
  rolling actions pass it (`against`, `opposition`), and the dice and each reroll read on the new
  band set `check`, the outcome bands with `succeed` marked ("Beat 2"), or the ladder against an
  opponent or target who rolls after. The dice-less `rung` step gives the result's ladder rung.
  Results are unchanged.
- 033d16d: Open to add-on packs: a stunt's `limit` is an open enum, so an add-on's stunt, or a custom stunt
  set to the add-on's limit, is used and counted by the core's `use`; the add-on resets its own
  limit.
- 033d16d: The ends of a conflict, scene and session tag their changes steps `time.conflict`, `time.scene`
  and `time.session`, so an add-on's rules-level `changes` effect resets its own stunt limit there.

### Patch Changes

- 033d16d: The random start draws its three stunts from every written stunt (any stunt but the custom one) instead of a list of the 17 SRD examples, so an add-on pack's stunts come up too; with fate-core alone the odds are unchanged.
- 033d16d: A stunt's `skill` and `replaces` take skills only (`where`), so a custom stunt's skill picker lists the skills and `setField` refuses any other field.
- f44f66c: Turn-order sort keys are hidden, and the Conflict group they filled is gone. The `teamwork` situational choice is removed: helpers count once, through `helper` participants or `skill-roll`'s `helpers` parameter. A consequence without words is reported (`consequence-label`).
- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).

## 0.1.1

### Patch Changes

- 72234ec: Number picks are value choices (`options: { values }`): how many aspects `skill-roll` invokes (paid and free), which stress box `take-hit` checks, and how many extra stunts creation buys. The steps read `steps.<id>.value`; their option IDs are now the numbers.
