# @opencharacter/5e-srd-5.2

## 0.4.0

### Minor Changes

- 4247ddb: Cunning Strike works out its Sneak Attack dice once, as the attack's derived parameter `cunningStrikeCost`, which the Sneak Attack and the strike effects read; its save DC is the feature's `strikeDc` computed value, read by the strike effects. The `rogue.strikeDc` field is removed (breaking: read the feature's `strikeDc` instead). The rules are unchanged.
- 71a3eb6: Deflect Attacks reduces an attack's total damage once: the `deflectAttacks` situational choice is `scope: batch`, so one selection reaches the whole attack, its 1d10 + bonus spent over its Bludgeoning, Piercing and Slashing parts in order (every damage type with Deflect Energy). When all the damage is stopped and a Focus Point is left (the new `focus.spent` field), its `changes` offer the new `deflect-redirect` follow-up (a rules action running the feature's action, available only while a Focus Point is left). Breaking: the choice is batch-scoped, and the `deflect-attacks` action no longer rolls the reduction: its `damage` parameter and `deflected` result are gone; it is the redirect (1 Focus Point, the redirected damage). A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
- 71a3eb6: A monster's AC, senses, XP and Legendary Action uses are copied onto its sheet, so the whole stat
  block is a snapshot (#216). `create-monster` sets them as inputs: `combat.printedAc` (a new field;
  it competes with worn armor and Mage Armor as any AC does), `senses.darkvision`,
  `senses.blindsight`, `senses.tremorsense`, `senses.truesight`, `senses.telepathy`, `challenge.xp`
  and `legendary.actions`, which were derived, and the new `challenge.xpLair` and
  `legendary.actionsLair`, which replace them while `legendary.inLair`. The `monster` item no longer
  sets them. Effects from traits, spells and items still apply on top. Upgrading from 0.3.0 saves a
  monster's values from its stat block; other characters get 0.
- 71a3eb6: Cunning Strike, Stunning Strike, Open Hand Technique, Hurl Through Hell and the Rod of Lordly Might's Drain Life and Paralyze are parameters of each attack (`cunningStrike`, `cunningStrike2`, `stunningStrike`, `openHand`, `hurlThroughHell`, `drainLife`, `paralyze`). On the hit, an `action` effect on the attack's `attack-hit` step hands the target its saving throw at the feature's DC and applies the condition (or Hurl Through Hell's 8d10 Psychic damage) on a failure; the cost (a Focus Point, the use or a Pact Magic slot, the rod's daily use) is spent with it. `weapon-attack` and `unarmed-strike` are tagged `attack-hit` (and the Unarmed Strike `unarmed`), so the parameters are added to those attacks only, Open Hand Technique's to the Unarmed Strike. Cunning Strike's dice come off the Sneak Attack, read from the parameters; an effect the rogue can't use (the new `rogue.strikeEffects`: not known yet, or Poison without a Poisoner's Kit), or effects together costing more than the Sneak Attack, do nothing and cost nothing. Its DC is the new `rogue.strikeDc` field. `item-power`'s outcome data adds `failed`. Breaking: the `cunning-strike`, `stunning-strike`, `open-hand-technique` and `hurl-through-hell` actions, the rod's `drain-life` and `paralyze` actions, and the `cunningStrike` situational choice are removed. A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
- 71a3eb6: Reactions to who hit you, read from the damage's sender (`change.from`): Hellish Rebuke offers its cast when another creature damages the caster; Fire Shield offers `erupt` when a creature hits the caster with a melee attack while the shield is up; Multiattack Defense records each creature that hits the ranger with an attack roll (a required follow-up, in Defensive Tactics' new `hitBy` state), exposed as `combat.multiattackDefense` so that creature's other attack rolls against the ranger have Disadvantage until the `turn-boundary` action clears it. Breaking: Fire Shield's `erupt` is listed on the spell's holder while the shield is up, no longer on the applied entry (`scope: applied`). A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again. The caster's or ranger's own damage to itself (`change.from` its own `id`) triggers none of them.

### Patch Changes

- 53c36f2: Chromatic Orb's first orb is its cast: the spell adds a `damageType` parameter to its own `cast-spell` (a `params` effect), and `cast-spell`'s new `spell.cast` step (its listing is tagged `spell.cast` too) sets the cast's damage type from it, so the ranged spell attack and the 3d8 (+1d8 per slot level above 1) come with the slot spent. The `orb` action stays for a leap. Conformance suite: `5e52-cast-chromatic-orb-type`.
- 71a3eb6: The Rod of Alertness's Protective Aura, Aura of Life, Holy Aura, Pass without Trace and Spirit Guardians project their aura from each applied entry the creature applied itself (`scope: applied`), one aura per entry (computeSheet's `auras` names that entry), whatever the spell was cast from. Aura of Courage and Aura of Devotion are auras for allies in `paladin.auraRange`, down while the paladin is Incapacitated, with `immuneTo` (Frightened, Charmed), so allies' immunity is no longer text.
- 53c36f2: Sap, Slow and Vex (and Studied Attacks' Vex) read who applied them from the entry's `appliedBy`, which every attack now records, instead of the `attacker` state the attack wrote; `attacker` stays declared and is still read for entries saved without an applier. A new rules action, `turn-boundary` (`clock: turn-boundary`), which the app runs on every creature at each turn change, ends Sap and Slow when their applier's next turn starts, and Vex when that turn ends (a new `armed` state on combat effects, default false, marks that the turn has started). Conformance suite: `5e52-turn-boundary` and `5e52-turn-boundary-ends`; `5e52-attack-vexed-target-advantage` expects the applier-reading query.

  Hex and Hunter's Mark: `hex.cursedBy` and `huntersMark.markedBy` name each applied spell's `appliedBy` (the `caster` state is no longer written, and is still read for entries saved without an applier), and each spell has a `move` action that ends the caster's curse or mark wherever it is (`removeEffect` `to: applied`) and puts it on the new target (Hex asks its ability again). Conformance suite: `5e52-hex-move` and `5e52-hex-cursed-by`; `5e52-cast-enhance-ability-per-target` no longer expects `caster` on the applied spell.

  When concentration ends, the new required follow-up `concentration-ends` ends the caster's concentration spells on every creature holding one (`removeEffect` `to: applied`, by the entries' `appliedBy`; entries saved without an applier stay the app's). Conformance suite: `5e52-concentration-ends`.

  effects.md: the Vexed example reads the entry's `appliedBy`.

  Hex's and Hunter's Mark's `move` is offered only while the caster concentrates, and the new target's entry keeps the slot the spell was cast with (the optional `slot` parameter, else the spell's level) and the caster's spell save DC (`castSlot`, `castDc`).

- 53c36f2: Aura of Protection and the Rod of Alertness's Protective Aura are auras (`auras`): computeSheet lists them while they are up (Aura of Protection while the paladin isn't Incapacitated, at `paladin.auraRange`; the rod while planted) for the app to place on allies inside. Aura of Protection's entry reads the paladin's live Charisma modifier through `appliers`. A creature in two Auras of Protection benefits from the highest (stackKey `source`), and the holder in its own aura counts it once.

  An aura is up only through its holder's own entry (one with no applier or applied by the holder), so a creature standing in another's Rod of Alertness, Spirit Guardians, Pass without Trace, Aura of Life or Holy Aura doesn't project it too. Conformance suite: `5e52-spirit-guardians-aura-not-passed-on`.

- 53c36f2: Brutal Strike's blows are modeled: the feature adds a blow parameter to every attack (`params` effect), and Improved Brutal Strike at level 17 a second, `brutalBlow2`. When the Brutal Strike hits, Hamstring Blow puts the new `combat-effects.hamstrung` on the target (Speed −15, the most recent one only) and Staggering Blow (Improved Brutal Strike) the new `combat-effects.staggered` (Disadvantage on its next saving throw, which ends it). Forceful Blow's push and Sundering Blow's +5 stay the player's. The combat effects group is labeled "Combat effects". Conformance suite: `5e52-attack-brutal-strike-blows`.

  Hamstring Blow ends at the start of the barbarian's next turn: the `turn-boundary` action removes it with Sap and Slow (`5e52-turn-boundary` expects it in the query). Staggering and Sundering Blow are offered from level 13: Brutal Strike's `brutalBlow` (Forceful or Hamstring) gives way there to Improved Brutal Strike's `improvedBlow`, which offers all four.

- 53c36f2: Spells carry the character's numbers: the spell type has computed values `castingClass`, `spellDc`, `spellAttack` and `spellMod` (in computeSheet's `activationValues`), worked out as `cast-spell` does (a stored spell's own numbers, a magic item's own DC and attack bonus, else the spellcasting's, else the character's highest). `cast-spell`, `spell-effect` and the actions of Moonbeam, Flaming Sphere, Ice Knife, Insect Plague, Glyph of Warding, Flame Blade, Guardian of Faith, Faithful Hound and Incendiary Cloud read them instead of recomputing; a spell on no list (Gift of the Depths' Water Breathing) now casts with the character's highest DC rather than 0, and a stored spell's later turns use its stored DC. Conformance suite: `sheets/5e52-spell-card-values`.

  Features carry their card numbers as computed values, which their actions read: Breath Weapon's `breathDc` and `breathDice`, Cunning Strike's `strikeDc`, Intimidating Presence's `presenceDc`, Relentless Rage's `rageDc`, Sacred Weapon's `weaponBonus` and Preserve Life's `healingPool`. Conformance suite: `actions/5e52-breath-weapon`.

- bf23fd5: Cunning Strike's Trip against a Huge or larger target costs no Sneak Attack die: it does nothing, so the full Sneak Attack lands, and an Improved Cunning Strike pair counts it as free. The conformance suite adds `5e52-attack-cunning-strike-huge`.
- ec9726a: 5e-srd-5.2: the D20 Test's rolls classify by a `d20` band set, its `success` band marked as the success threshold, so a roll's summary shows the DC or AC it needs (#175). Conformance tests for the attack and saving throw summaries.
- 769efe5: Deflect Attacks reduces the damage directly: a `deflectAttacks` situational choice on an incoming attack reduces the damage change it is selected on, if Bludgeoning, Piercing or Slashing (any type with Deflect Energy), by 1d10 plus the Dexterity modifier and Monk level, never below 0. A situational choice reaches only its own change, so an app selects it on one damage change of the attack (README, Limitations). The `deflect-attacks` action stays for redirecting the force.
- 71a3eb6: Magic items that need attunement have their effects only while attuned through `effectsWhen` on the `magicItem` type (and on each template that needs attunement), instead of a `self.attuned` check in every effect. Sheets compute the same.
- 53c36f2: Fire's Burn, Frost's Chill and Hill's Tumble are offered on a weapon or Unarmed Strike hit: the Goliath's hit option adds 1d10 Fire or 1d6 Cold to the hit's damage roll (doubled on a Critical Hit), and `changes` effects on the attack's damage step (now tagged `attack-hit`) slow or knock Prone the target (Large or smaller) and spend the Giant Ancestry use. The powers' own actions stay for other attack rolls. Conformance suite: `5e52-attack-frosts-chill`, `5e52-attack-hills-tumble-too-large`.
- 53c36f2: A magic item's power that is used since dawn or out of charges isn't offered: each `use: item-power` that presets `daily` or `charges` (the elemental-commanding bowl, brazier and censer, Dagger of Venom, Dragon Scale Mail, Dust of Dryness, Javelin of Lightning) has `available` on the use. Conformance suite: `5e52-javelin-of-lightning-used`.
- 769efe5: Precise Hunter gives Advantage on its own on an attack against a target whose view shows the ranger's Hunter's Mark (`huntersMark.markedBy`). The `preciseHunter` situational choice stays for an attack without the target's view.
- ca525b4: README: needs spec 0.4; sections reordered, Omitted is now Limitations' Out of scope; Cunning Strike reads the `rogue.strikeDc` field (#251); Spirit Guardians links #253; `attack-hit`, `unarmed-hit`, `unarmed-damage-type`, `rest.short` and `effectsWhen: true` described; Stone's Endurance's per-type limit noted.
- 53c36f2: Every pick a guided start or a level-up asks recommends one of the options it offers (`recommend` over `options`), so an automatic run of either start, or of a level-up to 20, finishes for every class: class skills, tools and subclasses, background and feature languages, expertise, spells (a class's staple spells first, then the highest level offered; the old lists ran out on later levels), invocations (only ones whose level prerequisite the warlock meets), Mystic Arcanum, Metamagic, Signature Spells and Spell Mastery, the species lineages and the other feature options. Recommendations that read `choice.picks` now read `options` (weapon masteries, Keen Senses, Skillful, the fighting-style cantrips). Conformance suite: `5e52-create-guided-recommended` and `5e52-create-higher-level` finish with no answers, `5e52-create-guided-pauses` is gone, and `5e52-level-up-warlock-auto` levels a warlock to 2 with no answers.
- 769efe5: Retaliation is modeled, as in 5.1: when the Berserker takes damage and stays up, each equipped melee weapon offers its attack, and an Unarmed Strike is offered too, as follow-ups (`barbarian.retaliation`). Whether the damage came from within 5 feet, and the Reaction, are the player's.
- 53c36f2: Spirit Guardians, Aura of Life, Holy Aura and Pass without Trace are auras (`auras`). Casting Spirit Guardians also puts the spell on the caster (a `changes` effect on `cast-spell`'s concentration step, now tagged `spell.concentrate`), which holds its 15-foot aura up: enemies inside have their Speed halved. Its new `guard` action runs the Wisdom save and the 3d8 (plus 1d8 per slot level above 3, Radiant or, with `necrotic`, Necrotic) for a creature the Emanation reaches, at the caster's spell save DC and without spending a slot, while the caster concentrates. Aura of Life (Necrotic resistance), Holy Aura (Advantage on saves, Disadvantage on attacks against them) and Pass without Trace (+10 Stealth, counted once by stackKey `source`), cast with no target, hold their auras up for allies. Conformance suite: `5e52-spirit-guardians-guard`, `5e52-cast-spirit-guardians-aura`, `5e52-spirit-guardians-aura`, `5e52-spirit-guardians-enemy` and `5e52-paladin-aura-ally`.
- ec9726a: A field shows in each display group it's in, and the repeat is intended (a summary repeats headline values), so apps don't dedupe; the display-hints doc says so. 5e-srd-5.2's `concentration.active` is in `combat` only, and orc-2e's and orc-sf-2e's spellcasting proficiency ranks (`spellcasting.rank`, the archetype ranks) are in their spellcasting group only, no longer in `proficiencies` too (#175).

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
