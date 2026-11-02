# @opencharacter/5e-srd-5.1

## 0.4.0

### Minor Changes

- 71a3eb6: Countercharm, the Rod of Alertness's Protective Aura, Pass without Trace and Spirit Guardians project their aura from each applied entry the creature applied itself (`scope: applied`), one aura per entry, whatever the spell was cast from. Aura of Courage and Aura of Devotion are auras for friendly creatures in `aura.range` while the paladin is conscious, with `immuneTo` (frightened, charmed). Breaking: their `aura-of-courage` and `aura-of-devotion` `ally` actions are removed; `ally` entries saved before keep their immunity. A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
- 2ed1d82: A monster's traits and actions are copied onto its sheet, as in 5e-srd-5.2 (#181). The `monster`
  item lists them in stat-block order (`entries`, replacing its grants and `ownCopies`), and
  `create-monster` adds a copy of each, so every one keeps its own uses and recharge and a GM can
  drop or change one on a single monster. Monster traits and Spellcasting are `monsterAction` items
  (`kind: trait`); each monster action has an `order`, and the spellcasting fields are
  `spellAbility`, `spellDc`, `spellAttack`, `casterLevel`, `innate` and `slots1`–`slots9`. The
  `monsterSpellcasting` type is gone, and the sheet's traits and actions group is sectioned and
  sorted by stat-block order. Upgrading from 0.3.0 turns a saved monster's granted traits and
  actions into copies, keeping their saved uses and recharge.
- 71a3eb6: A monster's AC, senses, XP and legendary action count are copied onto its sheet too, so the
  whole stat block is a snapshot (#216). `create-monster` sets them as inputs: `combat.printedAc`
  (a new field; it competes with worn armor and Mage Armor as any AC does), `senses.darkvision`,
  `senses.blindsight`, `senses.tremorsense`, `senses.truesight`, `senses.telepathy`, `challenge.xp`
  and `legendary.actions`, which were derived. The `monster` item no longer sets them. Effects
  (Darkvision, Devil's Sight, goggles, lycanthrope forms) still apply on top. Upgrading from 0.3.0
  saves a monster's values from its stat block; other characters get 0.
- 71a3eb6: `weapon-attack`, `unarmed-strike` and their damage steps are tagged `attack-hit` (the unarmed strike also `unarmed`). Stunning Strike and Open Hand Technique are parameters of those attacks (`stunningStrike`; `openHand` on the unarmed strike): on the hit, an `action` effect on that step spends the ki and hands the target its saving throw at the ki save DC, stunned or knocked prone on a failure. Breaking: the `stunning-strike` and `open-hand-technique` actions, which only reported the DC, are removed. A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
- 71a3eb6: Reactions to who hit you, read from the damage's sender (`change.from`): Hellish Rebuke offers its cast when another creature damages the caster; Fire Shield offers `erupt` when a creature hits the caster with a melee attack while the shield is up; Multiattack Defense records each creature that hits the ranger with an attack (a required follow-up, in the pick's new `hitBy` state), exposed as `combat.multiattackDefense` so that creature's later attack rolls against the ranger take -4 (as +4 AC). A new `turn-boundary` clock rules action, run by the app on every creature at each turn change, clears it. Breaking: Fire Shield's `erupt` is listed on the spell's holder while the shield is up, no longer on the applied entry (`scope: applied`). A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again. The caster's or ranger's own damage to itself (`change.from` its own `id`) triggers none of them.

### Patch Changes

- 53c36f2: When concentration ends, the new required follow-up `concentration-ends` ends the caster's concentration spells on every creature holding one (`removeEffect` `to: applied`, by the entries' `appliedBy`; entries saved without an applier stay the app's). Conformance suite: `follow-up-clear` expects it after a lost concentration check.
- 53c36f2: Aura of Protection, Countercharm and the Rod of Alertness's Protective Aura are auras (`auras`): computeSheet lists them while they are up (Aura of Protection while the paladin is conscious, at `aura.range`; Countercharm while the bard performs; the rod while planted) for the app to place on allies inside. Aura of Protection's entry reads the paladin's live Charisma modifier through `appliers`. The paladin's own bonus now needs it conscious, as the SRD says. A creature counts one Aura of Protection or rod bonus (stackKey `source`), so the holder in its own aura and an ally with an older `ally` entry aren't counted twice. The `ally` actions stay. Conformance suite: `5e-aura-of-protection-holder` and `5e-aura-of-protection-ally`.

  An aura is up only through its holder's own entry (one with no applier or applied by the holder), so a creature standing in another's Countercharm, Rod of Alertness, Spirit Guardians or Pass without Trace doesn't project it too, and Countercharm's `countercharm` and `end-countercharm` look at the bard's own performance only. Countercharm's bonus to saves against charm and fear counts once (stackKey `source`).

- 53c36f2: Spell cards carry the character's numbers: the spell type has computed values `castingClass`, `spellDc`, `spellAttack` and `spellMod` (in computeSheet's `activationValues`), worked out as `cast-spell` does (a stored spell's own numbers, a magic item's own DC and attack bonus, else the class's), and the spell block ends with "Save DC 14" or "Spell attack +6". `cast-spell` reads them instead of recomputing; a spell on no class's list now casts with the character's highest DC and attack bonus rather than 0. Conformance suite: `sheets/5e-spell-card-values`.

  The draconic ancestry carries its breath weapon's save DC and dice as computed values (`breathDc`, `breathDice`), which `breath-weapon` reads.

- 769efe5: Spells with a per-cast choice ask for it and apply it, as 5.2's do: the spell type has `castOptions` and the `option` state, and `cast-spell` asks for the option per target (or for the caster) and saves it on the applied spell. Protection from Energy (resistance to the picked type), Fire Shield (warm or chill: resistance to cold or fire, and an `erupt` action for the 2d8 on a melee attacker instead of damage at the cast), Enhance Ability (advantage on the picked effect's ability checks), Enlarge/Reduce (advantage or disadvantage on Strength checks and saves, ±1d4 weapon damage) and Blindness/Deafness (blinded or deafened on a failed save) use it. Conformance suite: `5e-cast-aid-upcast` expects the applied spell's empty `option`.
- 769efe5: Divine Smite is offered on the hit, as 5.2's is: a melee weapon attack's on-hit choice offers a smite per spell slot level the paladin has left (and the pact slot); picking one spends the slot and adds 2d8 radiant plus 1d8 per slot level above 1st (5d8 at most), plus 1d8 against an undead or a fiend, to the hit's damage roll, so a critical hit doubles it. The `divine-smite` action stays. Conformance suite: `5e-paladin-sacred-weapon-attack` expects the on-hit choice, `none` recommended.
- 71a3eb6: Magic items that need attunement have their effects only while attuned through `effectsWhen` on the `magicItem` type (and on each template that needs attunement), instead of a `self.attuned` check in every effect. Sheets compute the same.
- 769efe5: Guided creation (`create-character`) recommends the ability scores: each method (rolled, point buy, standard array) recommends them by the class's ability priority, the highest to its first ability (point buy at the same spread), as 5.2's does, so an automatic run no longer stops at the allocation. Conformance suite: `5e-create-guided-array` expects the recommended array and the pause at the first pending pick.
- 769efe5: Hunter's Mark is modeled, as in 5.2: casting it applies the spell to the target, the target's `huntersMark.markedBy` lists who marked it (each applied spell's `appliedBy`; also in the `target` view), and the caster's weapon damage against a creature it marked adds 1d6 of the weapon's type. Its `move` action ends the caster's mark wherever it is (`removeEffect` `to: applied`) and marks a new creature. Conformance suite: `5e-hunters-mark-move` and `5e-hunters-mark-marked-by`.

  Hunter's Mark's `move` is offered only while the caster concentrates, and the new target's entry keeps the slot the spell was cast with (the optional `slot` parameter, else 1st) as `castSlot`.

- 53c36f2: A magic item's power that is out of charges or used since dawn isn't offered: each `use: item-power` that spends charges has `available: self.charges >= <n>` on the use, and the Rod of Lordly Might's and the Staff of Thunder and Lightning's once-per-dawn properties check `usedToday` in their actions' `available`. Conformance suite: `5e-rod-of-lordly-might-used` expects `unknown-action`.
- 769efe5: README: the text-only count names the 16 options and traits without mechanics beside the 8 features (24 files, not 8).
- ca525b4: README: needs spec 0.4; sections reordered, Omitted is now Limitations' Out of scope; Spirit Guardians links #253; `attack-hit`, `effectsWhen: true` and `openHand` described; magic item count corrected to 320 files.
- 53c36f2: The guided start finishes unattended, as 5.2's does: its race, subrace, class and background recommend the first offered, and every pick creation or a level-up asks recommends one of the options it offers (`recommend` over `options`): class skills, tools, fighting styles and subclasses, languages, expertise, spells (a class's staple spells first, then the highest level offered), invocations (Agonizing Blast only with Eldritch Blast), the pact boon, Metamagic, Mystic Arcanum, the hunter's tactics, subraces and draconic ancestries, and each starting-equipment pick. An Ability Score Improvement recommends +2 to the highest ability that takes it, else +1 to two, else a feat. Conformance suite: `5e-create-guided-pauses` becomes `5e-create-guided-finishes`; `5e-create-guided-array` pauses its picks to show the hill dwarf's recommended tool; the point-buy, roll and if-proficient cases answer every pick; options cases expect the recommended option.
- 53c36f2: Spirit Guardians and Pass without Trace are auras (`auras`). Casting Spirit Guardians also puts the spell on the caster (a `changes` effect on `cast-spell`'s concentration step, now tagged `spell.concentrate`), which holds its 15-foot aura up: enemies inside have their speed halved; the save and damage after the cast are the app's (casting again would spend another slot). Pass without Trace cast with no target holds its 30-foot aura up for allies; a creature counts one +10 (stackKey `source`).

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
