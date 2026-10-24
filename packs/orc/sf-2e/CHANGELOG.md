# @opencharacter/orc-sf-2e

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
- 033d16d: Grant-only content (#172): class features, heritages, ability boosts and archetypes are held only through their grants and picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.
- 033d16d: Open to add-on packs: `mystic.connection` and `witchwarper.paradox`, weapon groups, damage types
  and ammunition kinds, armor groups, consumable, spell, affliction and persistent damage types,
  consumable and feat categories are open enums, so a dependent pack adds values with
  `extendEnums`. A choice of any skill offers `skills.offered`, and one of any Lore `skills.lores`,
  which an add-on's Lore joins with a rules effect; their options now come in alphabetical order,
  and Skill Training no longer offers Pathfinder Lores this pack doesn't have. New, Syncretic and
  Realized Epiphany read `mystic.otherExpertConnections`, `mystic.otherMasterEpiphanies` and
  `mystic.connectionRank`, which an added connection adds to. Creation and level-up steps carry
  tags (`creation.ancestry`, `creation.class`, `creation.finish`, `level-up.gain`, …) for an
  add-on's rules-level options and changes.
- 033d16d: Open to add-on packs: `cast-spell`'s `damageType` parameter is an open enum, so a spell an add-on
  adds with a new damage type casts through the core's action.
- 033d16d: Use the new format features. Additional Lore is one value choice whose effects reach the picked Lore's fields (saved picks keep their values). Fixation grants Additional Lore with its own Lore choice and presets Assurance from it, so its `topic` choice is gone: the upgrade moves a saved topic to the granted Additional Lore. Harmonic Sensitivity asks whether it trains Performance or gives Assurance in it, recommending what the rules pick; the upgrade asks saved characters. Elemental weapon and elemental barrier are applied to the caster with their element (Cast a Spell's new `element`), and while one is active the elemental connection's wall of fire and absolute zero take its element's trait and damage type. Guidance, sure strike (which now gives its advantage), true target and Treat Poison or Treat Disease end on the roll they change.

  Open to add-on packs (#144): the envoy's leadership styles, mystic connections, soldier fighting styles and witchwarper paradoxes and anchors offer every feature whose new `classOption` field names them; Sense Direction counts any gear tagged `tool.compass`.

### Patch Changes

- 033d16d: A spell's `copyTemplates` is an ordered `list`: its templates are read by rank in the order
  written, not sorted by ID.
- 033d16d: Text: the Envoy and Operative Dedication prerequisites read "Not an envoy" and "Not an operative".
- 033d16d: The consumables list's sections are named by category: Grenades, Medical, Serums, …
- f44f66c: Guided creation asks the four free attribute boosts before the class's choices, so the class's trained skills are asked once, with the count the final Intelligence gives. The random start keeps them after the class's choices, once the key attribute is known.
- f44f66c: Add the headline: the level once a class is picked, the ancestry and the class ("Level 1 Vesk Soldier").
- 033d16d: Lashunta Lore isn't offered to a character that already took Additional Lore for Lashunta Lore
  (a damaya lashunta's), so its granted Additional Lore no longer repeats the pick and every random
  start finishes.
- 033d16d: A Lore's increases and trained-by-increase fields show only once it is trained (or, for a Lore of
  the player's choice, named), so the skill increases group no longer lists every Lore; a custom
  Lore's trained-by-increase field takes its subject as its name. A custom Lore's subject input is
  always shown, kept to background, so clearing it no longer hides it.
- f44f66c: Drop the Afflictions group: the pack has no afflictions. The affliction type stays for homebrew.
- f44f66c: Less clutter on every sheet. Spell slot ranks, the extra slot and its spells show only when the character has those slots. A skill's proficiency rank is its modifier's companion, so the Skill proficiency group is gone. A custom Lore's subject input sits in Skills, as "Custom Lore subject (1)". Gun, solar, agile melee and familiar weapon proficiencies, damage immunities, a weapon parry and implanted augmentations show in their groups when they apply; the remaining helper values are hidden.
- f44f66c: Swim, fly, climb and burrow speeds show only when the character has them.
- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).

## 0.2.0

### Minor Changes

- 4fd78cc: Use the new format features. Assurance takes its skill as a pick (Lore skills included), preset by the grants that name it: Raised by Belief's divine skill, From the Shadows, Core Memories, Effortless Influencer's three skills and Fixation's topic. Assurance's `skill` state is dropped. The ancestry Lore feats and Extra Devotion grant Additional Lore preset. Fixation's saved Lore becomes its `topic` pick. Warblood Vesk presets two Brutal Anatomy grants: its saved attack becomes the first of its `attacks`, and the second is a pending choice. The modular and Re-Forge Solar Weapon steps and Core Memories offer value lists. Shield ends when it blocks.

## 0.1.1

### Patch Changes

- 37490f5: First npm release (0.1.0 could not be published).
