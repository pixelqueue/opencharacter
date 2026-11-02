# @opencharacter/orc-2e

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
- c1ab9fb: The belt of long life gives its temporary Hit Points again when invested: its own `effectsWhen`
  lifts the worn type's investiture gate (Invest an Item runs before the belt is invested), and its
  Constitution effects keep their own invested condition. Conformance suite:
  `orc-invest-belt-of-long-life`.
- c1ab9fb: Bless, protective wards and protector's sphere are cast on the caster, whose entry projects the
  emanation as an applied aura (`scope: applied`, one per cast) for the app to place on allies
  inside, instead of an entry per ally passed to the cast. Sustaining bless or protective wards to
  widen it is the spell's `widen` action (a `widened` state key the aura's size reads; wards to 30
  feet). The sphere's resistance by rank reaches allies through the caster's
  `spells.sphereResistance`. Entries already on allies keep their effects. Conformance suite:
  `orc-cast-bless-aura`, `orc-bless-widen`, `orc-bless-aura`, `orc-protectors-sphere-ally`.
- d698709: Elemental Fury on a target, before the elemental bloodline's influence is picked, deals untyped
  damage instead of computing the undeclared tag `damage.none`. That already failed when the action
  ran (`unknown-tag`, a computed tag must be declared), before applyChanges checked change tags.
- c1ab9fb: A check's reroll option may keep the better result (`reroll` flag 2) as well as the new one
  (1). Halfling Luck (a failed skill check or save), Cat's Luck (a failed Reflex save, the better
  result) and Spiritual Guides (a failed, not critically, Perception or skill check) offer their
  once-a-day rerolls on `check.reroll`, marking the feat used (a `used` state key, reset by daily
  preparations). Conformance suite: `orc-halfling-luck-reroll`.
- ca525b4: README: needs spec 0.4; sections reordered; bane links #253; Scars of Steel names its field; sustaining notes `widen`.
- c1ab9fb: Scars of Steel is a batch-scoped situational choice on a critical hit (`scarsOfSteel`, offered
  while raging and unused today): resistance equal to the Constitution modifier plus half the level,
  spent over the attack's physical damage, paid once per attack from the new input field
  `barbarian.scarsOfSteelUsed`, which daily preparations reset. Conformance suite:
  `orc-scars-of-steel`.
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
- f862b31: The champion's aura feats are auras (#208): computeSheet lists Aura of Courage, Aura of Despair,
  Aura of Determination and Aura of Life for the app to put on the creatures inside, sized by the
  new `champion.auraSize` (30 feet while Expand Aura's new effect is up). Aura of Courage lowers an
  ally's frightened value at the end of the champion's turn through `turn-boundary`. Aura of Life
  also gives the champion its +1 status bonus to saves against void. The auras are down while the
  champion is unconscious.
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
