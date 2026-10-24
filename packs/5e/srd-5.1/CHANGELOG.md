# @opencharacter/5e-srd-5.1

## 0.3.0

### Minor Changes

- 033d16d: Open to add-on packs: weapon damage type and ammunition, gear category and ammunition, tool,
  vehicle and magic item category, spell school and damage types, monster subtype and monster action damage
  types are open enums, so a dependent pack adds values with `extendEnums`. Creation and level-up steps carry
  tags (`creation.race`, `creation.class`, `creation.method`, `creation.finish`, `level-up.class`,
  `level-up.gain`, …) for an add-on's rules-level options and changes. An Efficient Quiver's javelin
  compartment counts weapons tagged `quiver.javelin`, not the javelin by ID.
- 033d16d: Open to add-on packs: creature types (`creature.type`, a monster's `creatureType`, a condition's
  `by` and the slaying ammunition's `slays`) are open enums, and an attack's target view follows
  the open `creature.type`, so an add-on's creature type is created, attacked and slain as the
  core's are. The damage type parameters of `item-power` are open too.
- 033d16d: The Draconic Bloodline's Dragon Ancestor picks a draconic ancestry (inactive, so its breath weapon
  and resistance stay the dragonborn's), replacing ten inline options; the upgrade renames saved
  picks (`red` to `draconic-ancestries.red`). Elemental Affinity reads the ancestry's `damageType`
  (`itemField`), and the hidden `draconic.damageType` field is removed.
- 033d16d: A monster's `ownCopies` is an ordered `list`: creating a monster adds those copies in stat-block
  order (the adult red dragon's Legendary Resistance before Fire Breath).
- 033d16d: Uses the new format features. Arcane Recovery sums the picked slot levels (`steps.slots.values`)
  and counts each level's picks against its spent slots. The once-per-rest invocations and Infernal
  Legacy mark their own pick or grant (`pick: owner`, `grant: owner`). A long rest resets
  invocations, Draconic Ancestry, Infernal Legacy and Relentless Endurance only when one was used
  (`countPicks`, `countGrants`). Colossus Slayer is offered from Hunter's Prey's pick (`picksOf`);
  the hidden `hunter.colossusSlayer` field is removed.

  Open to add-on packs: each class and background carries its own starting `kit` action
  (`startingKit`), a class orders a random start's abilities (`abilityPriority`, an ordered list of ability scores) and names its
  multiclass requirements (`multiclassAll`, `multiclassAny`), magic items name the classes that can
  attune (`attunementClasses`, replacing the `attunement.<class>` tags), containers add their own
  capacity, rests carry `rest.long` and `rest.short` for content to reset its uses, and Metamagic
  and the Hunter's options are `metamagic` and `hunterTactic` content. Saved Metamagic and Hunter
  picks move to the content IDs (upgrade 0.2.0 to 0.3.0). Starting equipment steps read
  `equipment/class/…` and `equipment/background/…`.

- 033d16d: A result band may mark its set's success threshold, `success: true`: the band a roll needs, what
  an app shows before the roll ("what you need"). A set marks at most one. The roll summary
  (`needs.summary`, a log entry's `summary`) and `text.rollTargets` carry the mark on its band; a
  pack's band condition text that needs a test's value no longer shows its raw template when the
  band has no tests. Every pack marks its banded checks, saves and attacks: the DC check's success,
  the attack's hit, Fate's `succeed` against the opposition, FitD's action roll at `partial` (a 4
  or 5 does what the player set out to do), Mothership's success and panic `pass`, Mörk Borg's test
  against the DR. Ladders, tables and fortune rolls have no threshold and mark none.
- 033d16d: Grant-only content (#172): class features, subclasses, ability score improvements, fighting styles, hunter tactics, metamagic, invocations, pact boons, racial and monster traits, subraces, draconic ancestries, background features, feats and monster spellcasting are held only through their grants and picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.

### Patch Changes

- 033d16d: Weapons, armor and magic items declare `usedToday`, so item-power's once-per-dawn path works on any item, not only those that declare the state themselves.
- f44f66c: A monster's sheet leaves out experience points, a character level of 0 and death saves, and shows carrying weight only once it carries something. A monster's XP is labelled "XP".
- f44f66c: Prerequisite texts are phrases naming only the requirement ("Wisdom 13 to multiclass", "Warlock level 9", "Pact of the Blade"), for the standard text to wrap with the owner's name.
- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).

## 0.2.0

### Minor Changes

- ff96122: Use the new format features. Death Ward holds its target at 1 hit point and ends. Eldritch Spear keeps a 300-foot range template on eldritch blast (the `eldritchBlast.range` field is gone). Arcane Recovery and Natural Recovery pick spent slots in a choice step instead of `level1`..`level5` params. The once-per-rest invocations keep `used` on their own pick, and Relentless Endurance and Infernal Legacy keep their uses on the trait, no longer on the class or race copy: the 0.1.0→0.2.0 upgrade script moves saved uses. The dragonborn breath weapon is once per short or long rest. Creation and `create-monster` pick in the copy they added.
