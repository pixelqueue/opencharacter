# @opencharacter/orc-2e

## 0.3.0

### Minor Changes

- 033d16d: A result band may mark its set's success threshold, `success: true`: the band a roll needs, what
  an app shows before the roll ("what you need"). A set marks at most one. The roll summary
  (`needs.summary`, a log entry's `summary`) and `text.rollTargets` carry the mark on its band; a
  pack's band condition text that needs a test's value no longer shows its raw template when the
  band has no tests. Every pack marks its banded checks, saves and attacks: the DC check's success,
  the attack's hit, Fate's `succeed` against the opposition, FitD's action roll at `partial` (a 4
  or 5 does what the player set out to do), Mothership's success and panic `pass`, Mörk Borg's test
  against the DR. Ladders, tables and fortune rolls have no threshold and mark none.
- 033d16d: Grant-only content (#172): class features, heritages, ability boosts, archetypes and domains are held only through their grants and picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.
- 033d16d: Open to add-on packs: the subclass identity fields (`barbarian.instinct`, `bard.muse`,
  `oracle.mystery`, …), weapon and armor groups, weapon, consumable, spell, affliction and
  persistent damage types, consumable and feat categories are open enums, so a dependent pack adds
  values with `extendEnums`. Each barbarian instinct sets `barbarian.instinct` itself, so an added
  instinct sets its own. A choice of any skill offers `skills.offered`, and one of any Lore
  `skills.lores`, which an add-on's Lore joins with a rules effect; their options now come in
  alphabetical order. Creation and level-up steps carry tags (`creation.ancestry`,
  `creation.heritage`, `creation.background`, `creation.class`, `creation.finish`, `level-up.gain`)
  for an add-on's rules-level options and changes.
- 033d16d: Open to add-on packs: `bomb-strike`'s `damageType` and `persistentType` and `cast-spell`'s
  `damageType` parameters are open enums, so a bomb or spell an add-on adds with a new damage type
  throws and casts through the core's actions.
- 033d16d: Use the new format features. `barbarian.instinct` is computed from the class's or Barbarian Dedication's instinct pick, and the hidden `rage.altType` field is gone: Rage reads the dragon instinct's breath pick. Tengu Feather Fan spends the use on its own pick. Guidance, sure strike, true target, weapon surge and Treat Poison or Treat Disease end on the roll they change.

  Open to add-on packs (#144): subclass choices (instincts, muses, causes, doctrines, orders, mysteries, rackets, bloodlines, patrons, schools, theses, research fields, hunter's edges, the animal instinct's animal) offer every feature whose new `classOption` field names them. Domains are `domain` content: Domain Initiate, Advanced Domain and Domain Acumen pick them (Acumen's by the mystery's `oracle.domains`), and Deity's Domain offers the spells naming a domain; the upgrade renames saved domain picks. Crowbars, compasses and shields against spells are recognized by tag.

### Patch Changes

- 033d16d: Text: "an" before a vowel in the investigator, alchemist and oracle dedications' prerequisites and
  advanced feats, the arcane and occult dragonblood feats and the 8th-rank slot trades.
- f44f66c: Class-only display fields show only for their class: bard muse, champion and cleric sanctification, cause, doctrine, druidic order, mystery, bloodline, patron, arcane school and thesis, and Drain Bonded Item's uses. The elemental influence shows for the elemental bloodline, the evolution spells with Arcane and Occult Evolution, favored weapons with a favored rank, the familiar's weapons when it has some, and alchemical bombs when above martial weapons. Swim, fly, climb and burrow speeds show when the character has them. The cleric's and champion's sanctification are "Deity's sanctification" and "Champion's sanctification".
- 033d16d: The consumables list's sections are named by category: Potions, Elixirs, Bombs, …
- f44f66c: Guided creation asks the four free attribute boosts before the class's choices, so the class's trained skills are asked once, with the count the final Intelligence gives. The random start keeps them after the class's choices, once the key attribute is known.
- 033d16d: A Lore's increases and trained-by-increase fields show only once it is trained (or, for a Lore of
  the player's choice, named), so the skill increases group no longer lists every Lore; a custom
  Lore's trained-by-increase field takes its subject as its name. A custom Lore's subject input is
  always shown, kept to background, so clearing it no longer hides it.
- f44f66c: The rogue's key attribute prerequisites are phrases, like the rest ("Ruffian racket").
- f44f66c: Less clutter on every sheet. Spell slot ranks, the extra slot and its spells show only when the character has those slots, and the divine font only for a font. A skill's proficiency rank is its modifier's companion, so the Skill proficiency group is gone, and a Lore shows only once trained. A custom Lore's subject input sits in Skills, as "Custom Lore subject (1)". Damage immunities, a weapon parry and Wave Fan activations show when they apply; the remaining helper values are hidden.
- 033d16d: A spell's `copyTemplates` is an ordered `list`: its templates are read by rank in the order
  written, not sorted by ID.
- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).

## 0.2.0

### Minor Changes

- 5e5ce95: Use the new format features. Shield, Flame Barrier, Energy Absorption, Enduring Might and the champion's reaction resistance end once they apply. Fire Shield's shield can Shield Block and is destroyed at its Hit Points. Granting content presets Assurance's skill, Additional Lore's Lore and the terrain of Terrain Expertise and Terrain Stalker. Assurance's skill is a pick now, also offering trained Lores: its `skill` state is dropped, so a saved one becomes a pending choice. Additional Lore gains Hag Lore for Changeling Lore. Terrain Scout gives its second terrain: characters with it get a pending `terrain` choice, and it can't repeat Terrain Stalker's terrain. Drain Bonded Item's `bondDrained` and `linkedFocusUsed` move from the wizard class copy to Arcane Bond's saved grant state.
