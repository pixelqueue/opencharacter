# @opencharacter/wwn-srd

## 0.2.1

### Patch Changes

- aae4b97: Every art shows the Effort its tradition has free: a computed `effortFree` on the art type, which also reaches the arts a class grants (Vowed, Elementalist and the rest).
- aae4b97: The Adventurer's two partial classes, the Mage's and the partial Mage's tradition, the Accursed's starting art and Xenoblooded's heritage recommend their first open option (`recommend: options[0]`), so these choices have a recommendation wherever they're asked, not only in creation's steps.
- 769efe5: Every Elementalist, full or partial, gains Elemental Resilience and Elemental Sparks with the tradition, and an Invoker's Traditional Education in Elementalism brings them too. Before, nothing granted them and the art picks left them out, so no character could have them.
- 769efe5: A Heal Specialist with Gifted Chirurgeon rolls the Specialist's pool on Heal checks (3d6, or 4d6 at its second level, best two kept) instead of adding Gifted Chirurgeon's extra die on top. The unused `skill-dice` stack key is gone: stack keys don't group pool dice.
- aae4b97: Nullifier: a save's new `magical` situational choice ("against a magical effect") gives a Nullifier +2, and the Focus projects a twenty-foot `nullification` aura that gives allies inside the same. The `nullified` choice stays for tables that don't place the aura; a `nullifier` stack key keeps it from adding to the Focus's or the aura's +2.
- ca525b4: README: new License section with the `not-affiliated` notice; `spell.cast` and `art.commit` listed; thrown and skill-dice notes; Limitations renamed.
- aae4b97: Retain Sorcery gives the casting back: committing its Effort after a cast takes one off `spells.castsUsed`, so the spell doesn't count against the day's castings (an Invoker's spell points aren't refunded). `cast-spell`'s spend step and `commit-effort`'s commit step are tagged `spell.cast` and `art.commit`, so content (and add-ons) can add changes to them.
- 44a8809: Gifted Chirurgeon's and a Specialist's extra dice share the `skill-dice` stack key (`highestOnly`) in place of Gifted Chirurgeon's guard on Heal Specialist picks: the larger pool still applies, now by the pool dice stacking rule.
- 769efe5: Armsmaster's and Deadeye's skill damage on a thrown weapon no longer add together: the pack's `skill-damage` stack key takes the highest.
- ec9726a: wwn-srd: a `traditions` display group lists the character's magical traditions, the one content type without a group (#175).
- aae4b97: Unarmed Combatant, Natural Weaponry and Unarmed Might set the unarmed die, Shock and Shock AC under one spanning stack key (`unarmed`, `playerChooses`, scored by the die): the character takes all three from the one source picked, the best die recommended. Before, each field was its own competing group, so a sheet could take one source's die and another's Shock AC.

  App state: the competing groups on the unarmed die, Shock and Shock AC are now one `unarmed` group spanning the three fields, with one option per source, so a pick an app saved for the old per-field groups has to be made again.

- aae4b97: `attack` asks whether the weapon is thrown only for throwable weapons; any other weapon's `use` fixes `thrown: false`. An art lists `commit-effort` only when it commits Effort and `release-effort` only when its Effort is ongoing, through `available` on the art type's `use` entries instead of type tests in the shared actions.
- aae4b97: Weapon cards show their numbers: each weapon copy has computed values for its hit bonus, damage bonus, Shock damage, the AC its Shock reaches and whether it ignores AC, as `attack` rolls them when the weapon is wielded. Armsmaster's and Deadeye's bonuses move from roll effects to new fields by use (`attack.<mode>.bonus` and `damage.<mode>.bonus` for melee, thrown, ranged and unarmed, `shock.melee.bonus`, `shock.unarmed.bonus`), which `attack` adds as parts, so the cards count them; the `skill-damage` stack key still keeps the better of the two on a thrown weapon.

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
- 033d16d: Grant-only content (#172): partial classes and magic traditions are held only through picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.
- 033d16d: The Mage's and the partial Mage's traditions are content of the new type `tradition` (its `trad` key in `key`) instead of inline options, so an add-on pack's tradition is offered too; the upgrade script renames saved picks (`high-mage` → `traditions.high-mage`, and so on). `tradition.<key>.tier` counts the picked tradition (2 under a class tagged `full-mage`, else 1). Each tradition's creation bonus skill is the new field `tradition.<key>.skill`, set by the content that brings the tradition, and creation gains them in one loop instead of a step per tradition. The spell lists a caster learns from read the tradition keys (`item.list` is a `trad` key, or `high`), and the spell-casting traditions are the new family `spellTrad`, so the casting mode, the spell picks and the spell-known check follow added traditions.
- 033d16d: Open to add-on packs: committing, releasing and resting change a tradition's Effort fields and
  creation and `improve` a skill's fields through `fieldId`, so an add-on's tradition joins
  `effortTrad` and its skill the `skill` family, and both work with the core's actions. A
  background's table entries, a focus's `bonusSkill` and a weapon's `skill` are open enums.

### Patch Changes

- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).
- 033d16d: Advancement actions are available only when something is owed: `level-up` when the XP reaches
  the next level, skill improvements (`improve-skill`, `raise-skill`, `learn-technique`) when there
  are skill points or credit to spend, and attribute boosts (`improve-attribute`,
  `boost-attribute`) when the next boost is affordable at the character's level.
- 033d16d: A spell's `list` and an art's `tradition` are open to add-on packs' values. The arts and Effort checks and `arts.owed` read the `artTrad` and `effortTrad` families instead of naming each tradition, and the traditions whose arts armor stops are the new families `armorTrad` and `heavyArmorTrad`. Steps add-on packs' rules effects reach carry tags: `creation.purse`, `creation.finish`, `advancement.level`, `rest.night` and `rest.scene`.
- 153b36f: A second partial Mage isn't offered once no tradition is open (after a partial Invoker). Random starts always finish: starting gear the character couldn't carry isn't offered, and Lucky reads an attribute score of 7 or less, so Xenoblooded can't undo it.
- 033d16d: Display: the attack actions' group is "Attacks" and the advancement actions' "Level up", apart
  from the Combat and Advancement field groups; the two arts named A Thousand Tongues are named by
  tradition (Bard, Blood Priest); skill credit shows in the Advancement group.
