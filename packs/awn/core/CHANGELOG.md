# @opencharacter/awn-core

## 0.2.0

### Minor Changes

- 033d16d: Mutation categories are content of the new type `mutationCategory`, and a mutation's `category` names one (`mutation-categories.sense`) instead of an enum value, so an add-on pack's category joins the "two in one category" pick; the d6 table keeps the book's six. The stigma fields are open to add-on packs' values. Steps add-on packs' rules effects reach carry tags: `creation.kit`, `creation.mutation`, `creation.finish` and `advancement.level`.
- 033d16d: Open to add-on packs: skills. The core's changes name a skill's fields through `fieldId`, so an
  add-on's skill (added to the `skill` family) is gained, raised and lowered by the core's actions,
  and a background's entries and the `improve-skill` and `gain-benefit` parameters are open enums.
- 033d16d: A result band may mark its set's success threshold, `success: true`: the band a roll needs, what
  an app shows before the roll ("what you need"). A set marks at most one. The roll summary
  (`needs.summary`, a log entry's `summary`) and `text.rollTargets` carry the mark on its band; a
  pack's band condition text that needs a test's value no longer shows its raw template when the
  band has no tests. Every pack marks its banded checks, saves and attacks: the DC check's success,
  the attack's hit, Fate's `succeed` against the opposition, FitD's action roll at `partial` (a 4
  or 5 does what the player set out to do), Mothership's success and panic `pass`, Mörk Borg's test
  against the DR. Ladders, tables and fortune rolls have no threshold and mark none.
- 033d16d: Grant-only content (#172): prepared survivors' list entries and mutation categories are held only through picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.

### Patch Changes

- 033d16d: Add-on packs' content joins creation and advancement. The prepared survivors' picks are content of the new type `prepared` (the item, quantity, readied, and what comes with it). A wasteland warrior's missile weapon is any primitive weapon with the new item field `kitAmmo`, which it comes with. Edge and focus limits are tags (`repeatable`, `first-edge`, `needs-mutant`, `makes-mutant`, `not-mutant`, `not-underdog`) instead of IDs; an edge or focus with the new item field `gainPart` runs its own `gain-part` action when taken (Educated, Mutant, Mutation Acceleration, Unstable Mutant), and edges give mutation points through the new field `mutations.points.edges`.
- 153b36f: `gain-benefit`'s `entry` is an enum of the background table entries, with names, so a bad entry fails at start with `wrong-type`. Guided creation keeps stowing and leaving gear behind until the load is within the push limit (`#done` isn't offered). The advancement actions group is labelled "Advancement actions".
- 033d16d: Creation actions (`mutate`, `roll-stigma`, `roll-negative-mutation`, `buy-mutation`,
  `roll-mutation`, `reassign-barred-skills`, `starting-equipment`, `kit-entry`, `gain-benefit`) are
  available only while the character is being created, and the helpers `gain-skill`, `bonus-skill`
  and `skill-points-toward` are no longer listed. `gain-edge` and `gain-focus` are available only
  when the level owes an edge or a focus level. Creation, level-up and the edges and foci that run
  them are unchanged.
- 033d16d: Gaining a skill with every skill at its cap no longer fails with `index-out-of-range`:
  `gain-skill` and `gain-benefit` finish with `none`, and `skill-points-toward` with every skill at
  level-4 does too, so a background benefit or barred-skill reassignment always finishes.
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
- 033d16d: Name text for every state key: AWN's focus `level`, weapon `shots`, mutation `origin` and
  negative mutation `light` (and the weapon's computed values), CWN's Neural Buffer `bufferUsed`,
  Godbound's gift `artifactEffort`.
