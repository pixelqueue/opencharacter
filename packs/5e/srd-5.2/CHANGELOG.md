# @opencharacter/5e-srd-5.2

## 0.3.0

### Minor Changes

- 033d16d: Open to add-on packs: weapon damage type, ammunition and mastery, feat category, gear category and
  ammunition, tool, vehicle and magic item category, spell school and damage types, monster type tag
  and monster action damage types are open enums, so a dependent pack adds values with
  `extendEnums`. Creation and level-up steps carry tags (`creation.class`, `creation.species`,
  `creation.trinket`, `creation.finish`, `level-up.class`, `level-up.gain`, …), and the weapon
  attack's mastery riders `weapon-mastery.rider`, for an add-on's rules-level options and changes.
- 033d16d: Open to add-on packs: creature types (`creature.type`, a monster's `creatureType`, a condition's
  `by` and the slaying ammunition's `slays`) are open enums, and an attack's target view follows
  the open `creature.type`, so an add-on's creature type is created, attacked and slain as the
  core's are. The damage type parameters of `spell-effect`, `item-power` and `throw-item` are open too.
- 033d16d: Giant Ancestry takes its lineage from the grant: it declares a hidden `lineage` state key, which
  the goliath's grant sets to its picked lineage, and its powers and the `stonesEndurance`
  situational read it instead of the goliath's pick, so any species granting Giant Ancestry passes
  its own lineage.
- 033d16d: Breath Weapon and Damage Resistance take their damage type from the grant: each declares a hidden
  `damageType` state key, which the dragonborn's grants set to its picked lineage's `damageType`
  (`itemField`), so any species granting them passes its own lineage's. The hidden
  `origins.draconicDamage` field and the lineages' effects setting it are removed, so a dragonborn
  lineage needs only its `damageType`.
- 033d16d: A spell's `castOptions` is an ordered `list`: cast options are offered in the book's order again
  (Hex: Strength first), not sorted.

  A monster's `entries` is an ordered `list` too: creating a monster adds its traits, actions and
  legendary actions in stat-block order.

- 033d16d: Sapped ends on the creature's next attack roll even when Advantage cancels its Disadvantage.
  Vex ends on the attacker's next attack roll against the vexed creature, a spell attack or an
  item's included, from the rules effect that gives the Advantage; the attacks' `unvex` steps are
  removed.
- 033d16d: Uses the new format features. Arcane Recovery is a guided choice of spent slots again, replacing
  its five integer parameters. Cast options are one values step over each spell's `castOptions`,
  replacing 61 option effects (answers are the value, `str`, not `spells.hex#str`). Sapped ends
  itself after the attack roll its Disadvantage changes, on every attack roll. Savage Attacker
  rolls the weapon's damage dice twice and keeps the better total. Eldritch Spear lengthens only a
  cantrip the warlock knows, and Improved Elemental Fury only the druid's own cantrips. Gift of the
  Depths and the species traits mark their own pick or grant (`pick: owner`, `grant: owner`).
  Colossus Slayer and the goliath's powers read their picks (`picksOf`); the hidden
  `ranger.colossusSlayer`, `origins.giantAncestry` and `origins.giantAncestryLeft` fields are
  removed.

  Open to add-on packs: each class and background carries its own starting `kit` action
  (`startingKit`), a class orders a random start's abilities (`abilityPriority`, an ordered list of ability scores) and names its
  multiclass requirements (`multiclassAll`, `multiclassAny`), and magic items name the classes that
  can attune (`attunementClasses`, replacing the `attunement.<class>` tags). Starting equipment
  steps read `equipment/class/…` and `equipment/background/…`.

- 033d16d: Grant-only content (#172): class features, subclasses, feats, metamagic, invocations, species traits and lineages are held only through their grants and picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.

### Patch Changes

- f44f66c: Basic poison's Coat a weapon and Antitoxin's Drink finish with a result.
- 033d16d: Weapons, armor and magic items declare `usedToday`, so item-power's once-per-dawn path works on any item, not only those that declare the state themselves.
- f44f66c: A monster's sheet leaves out experience points, a character level of 0, Heroic Inspiration and death saves, and shows carrying weight and attunement slots only once it carries or attunes to something. The monster start's average hit points option reads "Use the average".
- f44f66c: Prerequisite texts are phrases naming only the requirement ("Wisdom 13 to multiclass", "Character level 4", "Fighting Style feature"), for the standard text to wrap with the owner's name.
- 033d16d: The spells list's sections are named: Cantrips, Level 1 spells, … Level 9 spells.
- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).

## 0.2.0

### Minor Changes

- 5c4a76c: Use the new format features. Death Ward, Oil, Hypnotic Pattern and Eyebite's sleep end themselves. Multiattacks take a `charged` param for the charging attack. The Half-Dragon's Multiattack runs its Draconic damage. Eldritch Spear and Improved Elemental Fury extend the cantrip's range. Sibling picks are read with `picksOf`: the `origins.backgroundPlusTwo`, `origins.cantripReplaced`, `warlock.pactWeapons` and `warlock.lessons` fields are gone. The smite slot level and Lesser Restoration's condition are choice steps over values. Backgrounds preset Magic Initiate's list, and its `list` state is gone. Species traits and Gift of the Depths keep their own uses, moved off the species and Warlock copies by the 0.1.1→0.2.0 upgrade script. Giant Ancestry does too, with Stone's Endurance spending from its `then`.

## 0.1.1

### Patch Changes

- 37490f5: First npm release (0.1.0 could not be published).
