# @opencharacter/orc-sf-2e

## 0.4.0

### Minor Changes

- aedbd71: orc-2e and orc-sf-2e: Shield Block (`situational.shieldBlock`) reaches the whole attack (`scope: batch`). The shield's hardness comes off the attack's total once, however many damage types it splits into, and the raised shield takes what is left of the total, clamped to its remaining Hit Points: a block that destroys the shield no longer rejects the attack. The shield type's per-change `block` effect is gone, so the shield's `damage` entry in `adjustments` is now a `{ copies }` entry whose `source` is the choice (`{ type: situational, id: shieldBlock }`), not the item's `block` effect.

  What apps must change: select `shieldBlock` on the first damage change of an attack and route the attack's damage as one batch. The Shield spell and Fire Shield still block per damage change (#258).

  No saved shape changes. Conformance cases: a split Strike blocked once, and a block past the shield's Hit Points.

- f862b31: A spell whose caster picks its damage type or battle form declares the choice as a parameter of
  its own cast (a `params` effect on the new `spell-cast` tag, which only `cast-spell` carries), so
  `cast-spell` keeps taking `damageType` and `form` by the same names as before, but each spell
  offers only the types or forms it names: resist energy's `damageType` is acid, cold,
  electricity, fire or sonic, animal form's `form` one of its nine animals, and a spell that names
  none takes neither (breaking: values a spell doesn't name are refused, and `form` is an enum, not
  a free string). A staff's `prepare-staff` takes neither. The spell type's `damageTypeChoice` field
  is gone (breaking: an item field removed). Elemental toss and elemental blast deal the elemental
  influence's type; dragon breath and flurry of claws the draconic exemplar's tradition's, unless
  the cast names one. Saved characters are unchanged: the applied spell keeps its `damageType` and
  `form` state.

### Patch Changes

- ec9726a: A field shows in each display group it's in, and the repeat is intended (a summary repeats headline values), so apps don't dedupe; the display-hints doc says so. 5e-srd-5.2's `concentration.active` is in `combat` only, and orc-2e's and orc-sf-2e's spellcasting proficiency ranks (`spellcasting.rank`, the archetype ranks) are in their spellcasting group only, no longer in `proficiencies` too (#175).
- c1ab9fb: A check's reroll option may keep the better result (`reroll` flag 2) as well as the new one
  (1). Halfling Luck (a failed skill check or save), Cat's Luck (a failed Reflex save, the better
  result) and Spiritual Guides (a failed, not critically, Perception or skill check) offer their
  once-a-day rerolls on `check.reroll`, marking the feat used (a `used` state key, reset by daily
  preparations). Conformance suite: `orc-halfling-luck-reroll`.
- f862b31: Effects put on other creatures end by their applier's turns (#208). A new `turn-boundary` clock
  action, which the app runs on every creature at each turn change, ends a condition or effect
  whose new `duration` state is `next-start` when its applier's turn starts, and one that is
  `next-end` when its applier's next turn ends. A condition timed this way (or, in orc-2e, a
  debilitation) stays its own entry rather than merging into the same condition from elsewhere.
  orc-2e: Debilitating Strike and the racket feats' debilitations last until the end of the
  rogue's next turn, and a new debilitation first ends the rogue's earlier ones on that target.
  orc-sf-2e: Get 'Em! lasts until the start of the envoy's next turn, and a new one ends the
  earlier one on the envoy and on every ally. The new state keys have defaults, so saved
  characters are unchanged.
- c1ab9fb: Bless, protective wards and protector's sphere project their aura only from an entry the caster
  applied itself (`self.appliedBy == character.id`), so an older entry on an ally (no applier)
  keeps its bonus but projects nothing. Their `widen` action is once a turn (a `sustained` state
  key the caster's next turn clears) and carries the concentrate trait instead of the `spell` tag.
  A reroll that keeps the better result keeps the higher total on the same degree. Conformance
  suite: `orc-bless-sustain-turn-start`; `orc-bless-aura` pins an old-shape entry.
- f862b31: A held feat carries the holder's class DC and spell DC as computed values (#201): `classDc` (a
  class feat's own class's, and an archetype feat's its archetype's class's) and `spellDc`.
  Feat descriptions that say "your class DC" or "your spell DC" show the number when an app fills
  them (`{self_classDc}`, `{self_spellDc}`), and read as before otherwise.
- c1ab9fb: A failed check (`check`: skill actions, Perception, saves) offers a Hero Point reroll after the
  roll: a `check.reroll` choice step whose option the rules add while the character has a Hero
  Point, paying it in its `changes`. Declining is recommended, so an automatic run doesn't pause;
  the second roll (`rerolled`) stands. Spell Devourer reads the result that stands. Conformance
  suite: `orc-check-hero-point-reroll`; failed-check cases log the declined choice.
- c1ab9fb: Worn and held items with the invested trait work only while worn and invested through one
  `effectsWhen` on the `worn` and `held` types, instead of `self.equipped && self.invested` in each
  effect's `when`. Grants, kept templates and actions keep their own conditions; armor and runes,
  whose base works uninvested, keep theirs per effect.
- f862b31: `level-up`'s picks recommend (#205): a boost goes to the key attribute, then Constitution,
  Dexterity, Wisdom, Strength, Intelligence and Charisma, and any other pick to the first eligible
  option (`options[0]`), so under the automatic policy only the skill increase asks.
- f862b31: A spell cast as a reaction is listed in the reactions group: `cast-spell` adds the `reaction` tag
  by a computed tag when the spell's `cast` is `reaction`.
- c1ab9fb: Bless is cast on the caster, whose entry projects its emanation as an applied aura
  (`scope: applied`, one per cast) for the app to place on allies inside; Sustaining it to widen it
  is its `widen` action. The precog paradox's quantum field (a witchwarper's, or an archetype's
  with Basic Quantum Field) is two auras while it's active, `quantum.radius` across: enemies'
  Speeds −5 status, allies' +5 status. Anthem gives the bonded creatures passed as allies +1 status
  to attack and damage rolls and to saves against fascinated or confused (the new situational
  `againstFascinatedOrConfused`). Conformance suite: `orc-sf-bless-aura`,
  `orc-sf-precog-quantum-field`, `orc-sf-precog-field-ally`.
- c1ab9fb: Natural Grace (a failed Acrobatics check or Reflex save), Center Thoughts (a failed Will save,
  the better result) and the chosen pahtra (the first critically failed save each day) offer their
  once-a-day rerolls on the check's `check.reroll` step, marking the pick used (a `used` state key,
  reset by daily preparations). Conformance suite: `orc-sf-center-thoughts-reroll`.
- ca525b4: README: needs spec 0.4; sections reordered; bane links #253; Anthem names its situational choice; invested items and Hero Points described; auras and passed participants told apart.
- c1ab9fb: A Strike's critical hit tags the damage it deals `damage.critical`, as a spell attack's already
  does, so a reaction to a critical hit (Scars of Steel) is offered on it. `orc-scars-of-steel`
  now routes a real critical Strike's damage.

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
