# @opencharacter/cwn-srd

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
- 033d16d: Open to add-on packs: skills. The core's changes name a skill's fields through `fieldId`, so an
  add-on's skill (added to the `skill` family) is gained and raised by the core's actions, and a
  background's entries, a Focus's and an Edge's bonus skills, a weapon's `skill` and the
  `gain-skill` and `improve-skill` parameters are open enums.
- 033d16d: Grant-only content (#172): backgrounds, edges and spirit powers are held only through their picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.

### Patch Changes

- 033d16d: Open to add-on packs' values: cyberware `category`, a program's `subjectType`, a drone's `moveKind` and a spell's `duration`. Steps add-on packs' rules effects reach carry tags: `creation.item` (the free starting item's kind), `creation.gear`, `creation.finish`, `advancement.level`, `rest.night` and `rest.scene`.
- 033d16d: All Natural's exclusions read the new tag `bars-cyber` instead of its ID, so an add-on pack's Focus or Edge tagged `bars-cyber` bars cyberware-bringing picks the same way. The README notes how add-on content joins creation.
- 153b36f: `gain-edge` finishes `closed` for the 5th-level Edge below 5th level and for the Underdog Edge without the rule. `attributes.modTotal` sums the modifiers of the rolled scores, so the Underdog bonus Edge can't undo its own eligibility and every random start finishes. `end-scene`, `rest`, `first-aid`, `reload`, `use-drug`, `gain-attribute`, `trigger-cyber`, `acquire-wired-cyber`, `acquire-focus-gear` and `summon-spirit` end with a declared result. Martial Instinct's counters show only for characters who have it, and the committed Effort tiles have short labels.
- 033d16d: Gaining an Edge reads the rules' Edge choices with `picksOf(choice)`.
- 033d16d: `gain-focus` is available only when the level owes a Focus level, and `gain-edge` only while an
  Edge slot is open (it ends `closed` for a slot already taken). The helpers `gain-skill`,
  `gain-attribute` and `acquire-wired-cyber` are no longer listed: creation, level-up and the Edges
  and Foci that grant them run them.
- 033d16d: A spirit's summoning cost counts the core spirit's `powers` picks, and for any other spirit the
  new `powerCount` item field (default 0), so a homebrew spirit with or without powers computes its
  cost instead of failing with `no-such-key`.
- 033d16d: Display: the action groups are named apart from the field groups: "Level up", "Programs" and
  "Spells and spirits" beside Advancement, Hacking and Magic.
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
