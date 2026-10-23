# Second Edition fantasy rules (ORC)

**Second Edition fantasy rules under the ORC License** (Player Core, Player Core 2 and GM Core's
player-facing rules, the Remaster) as an [Open Character Format](https://opencharacterformat.org/)
pack, for apps that build, show and play these characters with an OCF engine. Its rules compute
the sheet (attributes, proficiencies, AC, saves, skills, spellcasting, Bulk), and its actions
create characters (guided or random), level them to 20th, Strike, cast spells, use skill actions,
run afflictions, and buy, sell and invest items. The books' setting (its world, deities, nations,
planes and characters) is left out.

## Install and load

```sh
pnpm add @opencharacter/engine @opencharacter/orc-2e
```

The package's default export is the built pack (a `PackRelease`), and `i18n/en` its English
text:

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import orc2e from '@opencharacter/orc-2e';
import en from '@opencharacter/orc-2e/i18n/en';

const loaded = loadRuleset([orc2e]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { ruleset } = loaded;

// A new character, made by the random creation start: every pick is drawn, so it finishes.
const blank = {
  specVersion: '0.2.0',
  id: 'new-character',
  packs: [{ id: 'orc-2e', version: '0.2.0' }],
  creating: true,
};
const created = startAction(ruleset, blank, {
  action: { id: 'orc-2e:random-character' },
});
if (!('status' in created) || created.status !== 'finished') throw new Error('not finished');
const applied = applyChanges(
  ruleset,
  blank,
  created.proposedChanges.map((p) => p.change),
);
if (!applied.ok) throw new Error(JSON.stringify(applied.errors));

const sheet = computeSheet(ruleset, applied.character);
console.log(en['fields.hp.max.name'], sheet.values['orc-2e:hp.max']?.value);
console.log(en['fields.defenses.ac.name'], sheet.values['orc-2e:defenses.ac']?.value);
```

The guided start (`create-character`) pauses for each pick instead, and `level-up` raises the
level, asking what the new level brings. The [quick start](https://opencharacterformat.org/guides/quick-start/)
and the [guides](https://opencharacterformat.org/guides/) explain each call. The variant rules
(Free Archetype, Automatic Bonus Progression, Proficiency without Level) are inputs an app turns
on for a table (`variants.freeArchetype` …). Where the books leave a rule open, the pack's
reading is listed under [Rule readings](#rule-readings).

## Scope at a glance

- **Modeled:** the core math (attributes, proficiency, checks and degrees of success, bonus types,
  resistances, weaknesses and immunities, conditions, dying and recovery, Bulk); all 16 ancestries
  with every heritage (the versatile ones included) and ancestry feat; all 64 backgrounds; all 16
  classes from 1st to 20th level with every class feat; all 51 archetypes with their feats and
  the dedication rule; every general and skill feat; 55 skill actions; spellcasting (prepared,
  spontaneous, focus, innate, archetype sources, scrolls, staves and wands) with every spell,
  focus spell and ritual of the three books; weapons, armor, shields, gear, runes, materials,
  consumables, alchemical items, worn and held magic items, specific items and item curses;
  afflictions with stages; money and investiture; GM Core's character variant rules. Details in
  [What's modeled](#whats-modeled).
- **Text only:** the parts of options that are narrative or the app's (movement and positions,
  time, other creatures' sheets, what the GM decides); see
  [Limitations](#limitations).
- **Out of scope:** animal companions, familiars, eidolons and mounts as creatures of their own,
  GM Core's relics and vehicles, the setting's proper nouns, and anything from the pre-Remaster
  (OGL) books, such as Ancestry Paragon and dual-class characters; GM Core's level 0 characters.

## License

- **License:** the ORC License. Its four notices (Article III) are in the manifest, which apps
  must pass on: the attribution is the pack's `credit`, and the other three are its `notices`
  (`orc`, `reserved-material` and `expressly-designated`). [`LICENSE`](LICENSE) carries
  them too, with where to find the license's text:

  > **ORC Notice:** This product is licensed under the ORC License located at the Library of
  > Congress at TX 9-307-067 and available online at various locations including
  > paizo.com/orclicense, azoralaw.com/orclicense, and others. All warranties are disclaimed as
  > set forth therein.
  >
  > **Attribution:** This product is based on the following Licensed Material: Pathfinder Player
  > Core © 2023 Paizo Inc., Designed by Logan Bonner, Jason Bulmahn, Stephen Radney-MacFarland, and
  > Mark Seifter. Authors: Alexander Augunas, Kate Baker, Logan Bonner, Jason Bulmahn, Carlos
  > Cabrera, Calder CaDavid, James Case, Eleanor Ferron, Steven Hammond, Joan Hong, Vanessa
  > Hoskins, James Jacobs, Jenny Jarzabski, Erik Keith, Dustin Knight, Lyz Liddell, Luis Loza,
  > Patchen Mortimer, Dennis Muldoon, Stephen Radney-MacFarland, Mikhail Rekun, David N. Ross,
  > Michael Sayre, Mark Seifter, Kendra Leigh Speedling, Mark Thompson, Clark Valentine, Andrew
  > White, Landon Winkler, and Linda Zayas-Palmer; Pathfinder GM Core © 2023 Paizo Inc., Designed
  > by Logan Bonner and Mark Seifter. Authors: Amirali Attar Olyaee, Logan Bonner, Creighton
  > Broadhurst, Jason Bulmahn, James Case, Jesse Decker, Eleanor Ferron, Fabby Garza Marroquín,
  > Jaym Gates, Matthew Goetz, James Jacobs, Brian R. James, Jenny Jarzabski, Dustin Knight, Jason
  > LeMaitre, Lyz Liddell, Luis Loza, Ron Lundeen, Stephen Radney-MacFarland, David N. Ross,
  > Michael Sayre, Mark Seifter, Owen K.C. Stephens, Amber Stewart, Clark Valentine, Landon
  > Winkler, and Linda Zayas-Palmer; Pathfinder Player Core 2 © 2024, Paizo Inc.; Authors: Amirali
  > Attar Olyaee, Alexander Augunas, Brian Bauman, Joshua Birdsong, Logan Bonner, Jason Bulmahn,
  > James Case, Jessica Catalan, John Compton, Paris Crenshaw, Jesse Decker, Eleanor Ferron, Fabby
  > Garza Marroquín, Steven Hammond, Sasha Laranoa Harving, Joan Hong, Nicolas Hornyak, Vanessa
  > Hoskins, James Jacobs, Jason Keeley, Dustin Knight, Avi Kool, Lyz Liddell, Nicolas Logue, Luis
  > Loza, Ron Lundeen, Patchen Mortimer, Stephen Radney-MacFarland, Jessica Redekop, Mikhail Rekun,
  > Alex Riggs, David N. Ross, Michael Sayre, Mark Seifter, Owen K.C. Stephens, Jason Tondro, Clark
  > Valentine, Andrew White, Landon Winkler, and Tonya Woldridge. If you use our Licensed Material
  > in your own published works, please credit us as follows: Open Character Format,
  > orc-2e pack, © 2026 the Open Character Format contributors.
  >
  > **Reserved Material:** Reserved Material elements in this product include all elements
  > designated as Reserved Material under the ORC License; the names "Pathfinder" and "Paizo"
  > appear only in the attribution, to identify the Licensed Material.
  >
  > **Expressly Designated Licensed Material:** This product contains no Expressly Designated
  > Licensed Material.

- **Reserved Material left out:** the setting (its world, nations, deities, planes and lore),
  named characters and organizations. Languages named after places of the setting are left out;
  the ancestries' additional languages are any language, and the Player Core 2 ancestries' own
  languages go by the ancestry's name (Catfolk, Kholo, Lizardfolk, Ratfolk, Tengu, Tripkee).
  Rules names the books print with a setting proper noun have neutral names here: Fey
  Realm Adept and Fey Realm Magic, Call of the Afterlife and Afterlife Lore, Lizardfolk Armaments
  and Lizardfolk Spirit Strike, the dhampir lineages Enduring Lineage and Discerning Lineage, the
  Giant and Druidic languages, the frozen lava and eternal eruption grades by level, and the
  artifacts Ancient Mirror, Intelligent Holy Blade and Legendary Ammunition.
- **Trademarks:** the pack's ID, folder and display name use no publisher's trademark. The
  source books' names appear only in the ORC attribution above; this pack is not affiliated with
  or endorsed by Paizo, and uses no logo or trade dress.
- **Text:** names, and short rules text written for the pack (conditions, feats, class features,
  ancestries, backgrounds, weapon traits), in `i18n/en.yaml` and, split by area, `i18n/en/`
  (`equipment.yaml`, `ancestries.yaml`, `ancestry-feats.yaml`, `backgrounds.yaml`,
  `feats.yaml`, `skill-actions.yaml`) and each later class's own file (`rogue.yaml`, …). The ORC License would allow the books' own wording; the pack paraphrases.

## What's modeled

- **Attributes** are modifiers (Remaster), from boosts: each boost is content (`boosts.str` …)
  picked in a choice, adding 1 to its attribute's count; a flaw takes 1 off; past +4 a boost is
  partial (two raise the modifier by 1). The ancestry's boosts and flaw (or the alternate two free
  boosts), the background's two (one of two attributes, then a free one, different), the class's
  key attribute, four free boosts at 1st level and four more at 5th, 10th, 15th and 20th.
- **Proficiency:** untrained 0, else 2 per rank plus the level. A skill's rank is derived: 1 when it is trained, plus the skill increases spent on it. Content that trains
  a skill (a background, a class's own skill) grants its tag into `skills.trained` and counts the
  training in `skills.trainings`; the player's own training choices (a class's free skills) grant
  into `skills.chosen`. A skill content trains twice, or content trains a skill the player
  already chose, frees a training for another skill (the rules' `extra-training` choice). The
  increases (`skills.<skill>.increases`) are an input whose `max` is the highest rank the level
  allows (expert, master from 7th, legendary from 15th) less the training, 0 while the skill is
  untrained; a skill increase on an untrained skill trains it instead
  (`skills.<skill>.trainedByIncrease`, which level-up offers only for an untrained skill), a
  training the player chose. Perception, saves, the class DC, armor and attacks are ranks the
  class and its features set by level. Ranks show by name (`format: { bands: rank }`).
- **Resistances and weaknesses** are incoming-change effects on `hp.current`, one damage change
  per type. Every resistance carries the stack key `resistance` (`highestOnly`) and every weakness
  `weakness` (`lowestOnly`), so only the highest of each that applies to a change counts:
  a strong-blooded dwarf druid's two poison resistances don't add up.
- **The sheet:** every skill (and the 54 Lores the backgrounds and ancestry feats use), Perception and its DC,
  Fortitude, Reflex and Will and their DCs, the class DC, AC (10 + Dexterity up to the armor's cap
  - proficiency + the armor's item bonus), Hit Points (ancestry + (class + Constitution) × level),
    Speed (the ancestry's, less armor and encumbrance), size, senses, traits and languages, and
    Bulk (light items are 0.1, summed and rounded down; encumbered past 5 + Strength, a
    rules issue past 10 + Strength).
- **Bonus types:** circumstance, status and item bonuses keep the highest of each type; the
  circumstance and status penalties the worst of each; untyped penalties all add, by stack key.
  Checks and DCs are tagged with what they are and what they're based on (`check`, `dc`, `save`,
  `skill`, `attack`, `attr.dex`, …), and a bonus aimed at many of them (every check and DC,
  Dexterity-based checks, saves, skill checks, attacks) is one effect on that set of fields, which
  stacks on each with its other effects. Typed bonuses chosen for one roll
  (`circumstanceBonus`, `statusPenalty`, …) are keyed roll effects: the roll carries the check's
  own typed effects, so they compete with the sheet's of their type. The class DC is tagged with
  the key attribute by a computed tag, so it is in that attribute's set.
- **Checks and degrees of success:** `check` rolls a d20 plus any check modifier (skill, Lore,
  Perception, save) against an optional DC, and `flat-check` a bare d20. The `degree` bands read the
  DC from the action and the d20 from the first kept face: critical success (beat it by 10),
  success, failure, critical failure (miss by 10), a natural 20 one step up and a natural 1 one
  down, worked out once as the set's value (the step's `bandValue` is the degree,
  0 to 3). Content turns a success into a critical success through the tally `successToCrit`,
  makes every degree better through `degreeShift` (Unwavering Mien) and keeps a natural 1 from
  lowering it through `naturalOneHolds` (Ageless Patience). A skill or Lore modifier whose
  rank is 0 has the computed tag `untrained`, which Untrained Improvisation's one effect reaches.
  The roll carries the checked field's tags.
  Fortune and misfortune are roll-twice situational choices that cancel. What a save is against
  (fear, emotion) is a situational choice.
- **Strikes:** every weapon (and every character's fist, a standard copy) has `strike`, against
  the `target`'s AC (its view) or `ac`. The attack uses Strength, Dexterity for ranged and thrown
  attacks, or the better with finesse; proficiency by category, or by the weapon groups of
  Fighter Weapon Mastery and Weapon Legend (computed values on the copy). The multiple attack
  penalty comes from `turn.attacks` (counted by each Strike, reset by `start-turn`) or the
  `attack` parameter: −5/−10, agile −4/−8; a reaction neither takes nor counts it. The attack
  roll reads the attack field (`attacks.str.mod` or `attacks.dex.mod`, which typed effects reach;
  the part tagged `part.attribute`, which content may replace) and the weapon's
  proficiency bonus; the penalty is the part tagged `part.map`, and the weapon's damage dice
  `part.weapon-die` (die steps); a potency rune is the weapon's keyed roll effect. Concealed and
  hidden targets and a dazzled attacker take a flat check first (Keen Eyes lowers it). Damage: the
  weapon's dice (two-hand in two hands, fatal on a critical hit), Strength for melee and thrown,
  weapon specialization and typed bonuses; a critical hit doubles it, every item of the roll
  (`multiply`), bonuses that effects add included (Point-Blank Stance), with
  deadly's and fatal's extra die added after doubling (two with a greater striking rune, three
  with a major one). Forceful, sweep, backstabber (precision damage to an off-guard target),
  propulsive (half Strength), thrown ranged weapons (Strength), versatile (the Strike's
  `versatile` parameter deals the other damage type), parry (an action: +1 circumstance bonus to
  AC until the next turn), and the situational choices volley, range increment, backswing and
  twin are applied; the damage is sent to the target, split by type. Runes set the template
  fields `potency` and `dice`.
- **Conditions** (applied content): blinded, clumsy, concealed, confused, controlled, dazzled,
  deafened, doomed, drained, dying, encumbered, enfeebled, fascinated, fatigued, fleeing,
  frightened, grabbed, hidden, immobilized, invisible, off-guard, paralyzed, persistent damage,
  petrified, prone, quickened, restrained, sickened, slowed, stunned, stupefied, unconscious and
  wounded, with their effects on checks, DCs, AC, Speed and Hit Points. Valued conditions keep
  their value in state, and gaining one again keeps the higher value (`reapply`);
  persistent damage keeps the higher damage per damage type. Frightened reads Bravery's
  reduction. Conditions that include others grant them as applied content:
  unconscious is blinded and off-guard, dying unconscious, grabbed and restrained off-guard and
  immobilized, and so on.
- **Dying:** 0 Hit Points stores `knocked-out` as a required follow-up (dying 1, or 2 from a critical hit, plus wounded,
  and unconscious); damage while dying raises dying; healing ends it (`lose-dying`, wounded + 1);
  `recovery-check` (DC 10 + dying, Toughness 9) at the start of the turn; death at 4 + Diehard −
  doomed, a rules issue.
- **Turns** (the app runs them): `start-turn` resets the turn's attacks and flourishes, a
  raised shield and Dueling Parry, takes stunned's actions, makes a dying character's recovery
  check and reports the actions this turn (3, + quickened, − slowed and stunned); `end-turn`
  lowers frightened. Persistent damage is each entry's own action: the damage,
  then a DC 15 flat check that ends it on a success. Sickened has its own Retch action.
- **Shields:** `raise-shield` (and Reactive Shield) give the shield's circumstance bonus to AC;
  Shield Block is a situational choice on incoming damage: the hardness comes off,
  and the shield takes the rest in its `damage` state; broken shields give no bonus.
- **Ancestries:** dwarf, elf, gnome, goblin, halfling, human, leshy and orc, with Hit Points, size,
  Speed, boosts and flaw, languages, senses and traits, and every Player Core heritage (45):
  resistances of half the level, senses, traits, trainings, Hit Points, a swim Speed, situational
  saves (forced movement, void, undead, diseases), the jaws and spines unarmed attacks (standard
  copies of their heritage), and the rest as text. The four versatile heritages (aiuvarin,
  dromaar, changeling, nephilim) have no ancestry, so every ancestry offers them; aiuvarin and
  dromaar add the elf or orc to `ancestry.held` for ancestry feats, and a changeling or nephilim
  whose ancestry has low-light vision gets darkvision. `heritages.held` names the heritage.
- **Ancestry feats:** all 87 of 1st and 5th level. Weapon Familiarity counts the ancestry's
  weapons a category lower (`attacks.familiar`, read by the weapon's rank); the Lore feats train
  an ancestry Lore (dwarf, elf, goblin, halfling, leshy, orc) and two skills; tusks and seedpods are
  standard copies of their feats, and Iron Fists keeps a template on the fist; saves against control, sleep, fey, illusions
  and the superstitions are situational choices; skill actions the pack doesn't run are named in
  the skill actions' rolls (`skill-action.<id>`). 53 have effects; the rest are text. From 9th to
  17th level, all 56, and the versatile heritages' 43 feats (1st to 17th), which name their
  heritage (`heritage`), so the ancestry feat slots offer them: 75 of the 99 have effects,
  actions, grants or choices (innate spells the pack has, Bestial Manifestation's and the
  changelings' claws as standard copies, Nephilim Resistance, Mountain's Stoutness, Telluric Power,
  Thorned Seedpod, Undying and Rampaging Ferocity, Stonewall, Reckless Abandon's `degreeFloor`,
  Bounce Back in `lose-dying`, Mist Child's flat check, the innate spells above 3rd
  rank and the climb and fly Speeds, Cloak of Poison, Blessed Blood, Spell Devourer
  and Instinctive Obfuscation, acting on the attacker through the defender's own actions); the
  rest are text (movement, Divine Wings' wings for a time, companions). Once-a-day uses of
  feats picked at the rules level keep their daily use as their pick's state, which daily preparations reset.
- **Player Core 2's ancestries** (`rules/ancestries-pc2.yaml`, text in
  `i18n/en/ancestry-<ancestry>.yaml`): catfolk, hobgoblin, kholo, kobold, lizardfolk, ratfolk,
  tengu and tripkee, with their 54 heritages, and the versatile dhampir (void healing,
  `defenses.voidHealing`), dragonblood (an optional draconic exemplar named by its tradition and
  breath, `rules/dragonblood.yaml`) and duskwalker. Their unarmed attacks (the kholo's bite, the
  lizardfolk's claws, the ratfolk's teeth, the tengu's beak, heritages' claws, jaws and talons)
  are standard copies; a heritage can set the size (an ant kholo is Small, `heritage.size`).
  Languages are named after their ancestry (the setting's names left out); the kobold's
  Sakvroth is one more language of choice. All 217 ancestry feats, 1st to 17th: 111 with
  effects, actions, grants, choices or kept templates (Lore feats, Weapon Familiarity, innate
  spells, unarmed attacks and their upgrades, resistances, Speeds, saves, Catfolk Dance, Leech-Clip,
  Cantorian Rejuvenation, Breath of the Dragon with each creature's basic save against
  `ancestry.dc`, Majestic Presence), 106 text. Player Core 2's 16 weapons
  (hampering, razing, tethered and modular are names; their effects text).
- **Backgrounds:** all 40 of Player Core and all 24 of Player Core 2 (8 of them rare): boosts (one of two attributes, then a free one), a
  trained skill (or a choice where the book offers one) and a Lore (a choice of six terrain Lores
  where the book says "a Lore of a terrain"), and a skill feat. A Lore of a city or a deity is the
  first of three Lores of the player's choice, named by the subject the player writes
  (`skills.lore.custom1.subject`); Additional Lore offers all three. Assurance (farmhand, nomad, raised by belief, scholar) is an action for the skill it's
  chosen for: a fixed 10 + the proficiency bonus against the DC, no dice and no other bonus or
  penalty. Its skill is a pick (any skill, or a trained Lore), which content granting Assurance for a named skill presets: each background's Assurance is for the skill the book names (the driver's Lore, the scholar's and raised by belief's chosen skill, an inline option each). Player Core 2's eight new Lores and its
  ten ancestry Lores are `rules/lores-pc2.yaml`; the cursed background's Warding Sign is the
  situational choice `wardingSign`, the feybound's Fey's Fortune `fortune`.
- **Feats:** a slot per level for ancestry (1, 5, 9, 13, 17), general (3, 7, 11, 15, 19; skill feats
  too), class (1 and even levels) and skill feats (even levels), none taken twice unless `repeatable`. Each schedule,
  and the boosts at 5th, 10th, 15th and 20th, is one slotted choice with one
  prompt. General and skill feats: all 111 of Player Core up to 7th level (19 general, 92 skill;
  a skill feat's `skills` are the skills its prerequisites name, `skill.lore` for any Lore,
  `skill` for any skill),
  with prerequisites by proficiency rank (`skills.<skill>.rank >= 2` is expert), attribute, feat
  and Perception rank. Canny Acumen, Weapon and Armor Proficiency, Adopted Ancestry, Ancestral
  Paragon, Skill Training, Additional Lore, Untrained Improvisation, Multilingual, Hefty Hauler
  and Breath Control have effects; 34 change the skill actions below. From 8th level: Incredible Investiture and the 14 legendary skill feats, Cloud Jump, Legendary
  Codebreaker and Unified Theory changing actions, Divine Guidance, Legendary Medic, Legendary
  Negotiation and Scare to Death actions of their own (Scare to Death hands the target its
  Fortitude save), the rest text. A feat that may be taken more than once
  (Assurance, Skill Training, Armor Proficiency, Domain Initiate, the Qi Spells feats, Mercy, …)
  is `repeatable`, eligible in every feat slot. When each take needs a different pick, its choice
  shares an exclusivity group across takes and requires an option (`requiresOption`), so the feat
  isn't offered once the picks run out; a take allowed only from a level (Major Lesson's second
  and third, Deeper Dabbler's second) is a prerequisite on a count of takes. A feat content gives outright waives its prerequisites (`waivePrerequisites` on
  the grant), and a skill content trains that the player chose already frees a training instead.
  Player Core 2's 59 general and skill feats: 23 with mechanics (Bon Mot, Dirty Trick,
  Disturbing Knowledge and Evangelize as actions; Acrobatic Performer, Concealing Legerdemain,
  Crafter's Appraisal, Deceptive Worship, Distracting Performance, Exhort the Faithful, Eyes of
  the City, Slippery Prey, Risky Surgery, Robust Health, Armored Stealth and Rapid Affixture
  wired into the skill actions and equipment rules; Assured Identification, Thorough Search, Eye
  for Numbers, Glean Contents, True Perception), 36 text. Snare Crafting and Rapid Affixture are
  granted by the Snarecrafter Dedication and Quick Fix.
- **Skill actions** (`rules/skill-actions*.yaml`): Player Core's 55, each a rules action
  rolling the skill's `check` tagged `skill-action.<id>` against `dc` or the DC the rules name,
  read from a participant's view (a target's Will, Reflex, Fortitude or Perception DC; 10 + a
  skill modifier for a Deception, Stealth or Athletics DC); trained ones are available when
  trained. Demoralize frightens, Trip knocks prone (1d6 bludgeoning on a critical success),
  Grapple grabs or restrains, Escape frees; Treat Wounds (any DC your rank allows, an hour
  doubling it) and Battle Medicine heal, Treat Poison and Treat Disease give the next save a
  circumstance modifier (an applied effect that save removes), Administer First Aid stabilizes;
  Feint makes the target off-guard to your melee Strikes (`feint.target`, which the Strike reads); a critical
  failure to Trip or Shove is prone, to Disarm off-guard; Subsist's failure is fatigued. Attack-
  trait actions take and count the multiple attack penalty. Actions against several creatures
  (Hide, Sneak, Lie, Coerce, Make an Impression, Seek, …) roll once and give each one's degree
  (`degrees`), the roll classified again against each DC with every tally. Distances, income (Earn Income's table), Craft's daily reduction, Repair's
  Hit Points and Learn a Spell's price are the outcome's data. Encounter actions are the
  `skill-actions` group, exploration and downtime ones `exploration-actions`.
- **The fighter**, 1st to 20th level: its proficiencies and their increases, Reactive Strike
  (an action that runs a melee weapon's Strike as a reaction), Shield Block, Bravery, Fighter Weapon Mastery and Weapon Legend (a
  weapon group each), Battlefield Surveyor, Weapon Specialization and Greater Weapon
  Specialization, Battle Hardened, Tempered Reflexes, Combat Flexibility and Improved Flexibility
  (a feat choice each), Armor Expertise and Mastery, Fighter Expertise and Versatile Legend.
  Feats: Double Slice, Exacting Strike, Point-Blank Stance, Reactive Shield, Snagging Strike,
  Sudden Charge and Vicious Swing (1st), Dueling Parry, Intimidating Strike and Lunge (2nd). The
  ones that are Strikes are actions of their own: each picks a weapon (Double
  Slice two) and runs that copy's Strike, tagging it (`strike.vicious-swing`,
  `strike.double-slice`) for the feat's own roll effects, and adds what the feat does after it
  (an extra attack or a flourish counted, off-guard, frightened applied to the target, which
  keeps the higher value). A flourish is counted, and a second one in a turn is a rules issue.
- **The rogue**, 1st to 20th level: its proficiencies and their increases, a skill feat
  at every level and a skill increase at every level from 2nd (`skills.increasesPerLevel`, which
  level-up reads). The racket (mastermind, ruffian, scoundrel, thief) trains its skills and names
  the other key attributes allowed; the mastermind's skill of four is the racket's own choice,
  asked right after it and before the free skills, so they leave it out. Sneak attack (1d6 to 4d6 precision damage) is a roll effect on
  Strikes against an off-guard target: the target's view, the player's `offGuardTarget`, or a
  feat's Strike given it (Twin Feint); agile, finesse and ranged weapons, or a ruffian's
  small-die weapons. A thief adds Dexterity for Strength on finesse melee damage. Debilitating
  Strike sends a debilitation (an applied effect) or enfeebled 1 to the target, two from 15th.
  Evasive Reflexes, Rogue Resilience and Agile Mind turn successes into critical successes. Feats:
  33 of levels 1 to 6; Twin Feint, Underhanded Assault, Head Stomp, Mug and Twist the Knife are
  actions, Nimble Dodge a toggle (the start of the turn clears it), Trap Finder a situational
  choice.
- **The ranger**, 1st to 20th level: Hunt Prey stores the target's participant ID
  (`prey.target`), which roll effects compare with a Strike's target; checks, which have no
  target, use the situational choice `huntedPrey` (+2 to Seek and Track it). Flurry replaces the
  Strike's multiple attack penalty against the prey (−3/−6, agile −2/−4);
  Precision adds 1d8 to 3d8 precision damage by the hits on the prey this turn, which it counts on
  each Strike's hit (`prey.hits`) and the start of the turn sets back; Twin Parry
  ends at the start of the turn too; Outwit's skill bonus is the situational choice, and its AC
  bonus is the ranger's `defenses.acPrey`, which the prey's Strikes and spell attacks read.
  Feats: 25 of levels 1 to 6; Hunted Shot, Twin Takedown, Hunter's Aim, Disrupt Prey and Skirmish
  Strike are actions, and Quick Draw draws the weapon and Strikes with it on the proposed sheet. Quick Draw, Scout's Warning and Skirmish Strike
  are rogue feats too: a class's feat choice lists the feats it shares by ID.
- **The barbarian** (Player Core 2), 1st to 20th level: Rage is an action that applies
  Raging (an `effect`, applied content) to the barbarian and sets the temporary Hit Points (level
  - Constitution, unless a rage ended within the minute); Raging adds the Rage damage to melee
    Strikes (halved for agile), of the instinct's type when the rage uses it. End rage removes it.
    Instincts: animal (its unarmed attacks, standard copies that Rage equips), dragon (a breath
    damage type), fury (a bonus feat), giant (a larger weapon, with clumsy 1), spirit and
    superstition, each with its Rage damage at 1st, 7th and 15th and its Raging Resistance types.
    Furious Footfalls, Juggernaut and Indomitable Will are effects. Feats: 31 of levels 1 to 6
    (Sudden Charge and Intimidating Strike are the fighter's, Reactive Strike grants the fighter's
    feature); Furious Finish, Barreling Charge, Cleave, Mage Hunter, Shake It Off, Inner Strength and
    Wounded Rage are actions.
- **Stances, panache, stratagems and parries** are `effect` content, as Raging is: an
  action applies them to the character itself, and the app ends them when their duration does. Entering a stance removes every applied stance first, so one is applied at most; a
  stance's unarmed attacks are its standard copies, so they exist while it's applied (an unarmed
  attack's Strike needs no equipping).
- **The monk** (Player Core 2), 1st to 20th level: Strength or Dexterity, its proficiencies and
  their increases, Flurry of Blows (two unarmed Strikes and a flourish; Stunning Blows hands the
  target a Fortitude save against the class DC), Powerful Fist (a template kept on the fist, 1d6),
  Incredible Movement (a status bonus to Speed without armor), Mystic, Metal and Adamantine
  Strikes (text), Expert and Master Strikes, Path to Perfection and its second and third paths
  (a value choice each; the third makes a critical failure a failure, the tally `critFailToFail`),
  Graceful Mastery and Legend, Monk Expertise and Perfected Form (`minimumFace` on the turn's
  first Strike). Feats: Crane, Dragon, Mountain, Tiger and Wolf Stance, Monastic Weaponry and Qi
  Spells (1st); Crushing Grab, Dancing Leaf and Stunning Blows (2nd); Cobra Stance, Deflect
  Projectile, Flying Kick and Stand Still (4th); Mountain Stronghold, One-Inch Punch, Tiger Slash
  and Water Step (6th). The stances' attacks (crane wing, dragon tail, falling stone, tiger claw,
  wolf jaw, cobra fang) are weapons in `content/weapons/unarmed`. Qi spells: Qi Spells
  sets the qi spells' tradition (divine or occult: the rules choice `qi-tradition`, asked once
  however often the feat is taken), Wisdom and trained spellcasting (expert with
  Monk Expertise, master with Graceful Legend) and grants inner upheaval or qi rush; Harmonize
  Self (4th), Advanced Qi Spells (6th), Clinging Shadows and Wild Winds Initiate (8th), Wind Jump
  (10th), Shadow's Web (14th), Master and Grandmaster Qi Spells (16th, 18th) grant the other 11.
  The two stance spells grant an effect setting `stance.current` (wild winds with its wind crash
  attack as a standard copy).
- **The swashbuckler** (Player Core 2), 1st to 20th level: Dexterity, its proficiencies and their
  increases, the six styles (a skill and the style for Exemplary Finisher), panache (a bravado
  check, tagged `bravado` for Stylish Combatant's bonus, gives it on a success, or until the end
  of the next turn on a failure), Precise Strike (flat on a Strike, d6s on a finisher's), Confident
  Finisher (half the dice on a failure), Opportune Riposte, Stylish Tricks (one more skill
  increase and skill feat at 3rd, 7th and 15th, for Acrobatics or the style's skill: level-up's
  own `stylishIncrease` step, and a feat choice by the feat's `skills`), Vivacious
  Speed, Exemplary Finisher (a fencer's off-guard; the other styles' effects are text),
  Confident and Assured Evasion, Reinforced Ego, Keen Flair (the tally `successToCritOn19`) and
  Eternal Confidence. Feats: Disarming Flair, Elegant Buckler, Extravagant Parry, Flying Blade
  and Goading Feint (1st); Brandishing Draw, Finishing Follow-through, Retreating Finisher and
  Unbalancing Finisher (2nd); Even the Odds, Flamboyant Athlete, Swaggering Initiative and
  Twirling Throw (4th); Combination Finisher, Precise Finisher and Vexing Tumble (6th).
- **The investigator** (Player Core 2), 1st to 20th level: Intelligence, its proficiencies and
  their increases, a skill increase at every level from 2nd (level-up's budget
  `skills.increasesPerLevel`), the four methodologies (a skill each, Empiricism's asked before
  the free skills; Empiricism's That's Odd and
  Forensic Medicine's Battle Medicine granted), On the Case (Pursue a Lead's bonus, the
  situational choice `investigating`), Devise a Stratagem (a d20 kept in the applied attack
  stratagem, whose Strike uses Intelligence and Strategic Strike's dice, and the stored d20 as its
  own), the skill stratagem's bonus, Skillful Lessons (a skill feat at odd
  levels, for an Intelligence-, Wisdom- or Charisma-based skill, by the feat's `skills`), and the
  features by level to Master Detective.
  Feats: Eliminate Red Herrings, Flexible Studies, Known Weaknesses, Takedown Expert and That's
  Odd (1st); Athletic Strategist, Certain Stratagem, Shared Stratagem and Solid Lead (2nd);
  Detective's Readiness, Lie Detector, Scalpel's Point and Strategic Assessment (4th);
  Predictive Purchase and Thorough Research (6th).
- **Caster classes**, 1st to 20th level: each with its proficiencies and their
  increases, its features by level (expert, master and legendary spellcaster among them), its
  spellcasting on the framework below, its options, its focus spells and its class feats to 20th
  level. Feats several casters share (Reach Spell, Widen Spell, Familiar,
  Cantrip Expansion, Enhanced Familiar, Bespell Strikes, Steady Spellcasting) are kept once in
  `content/feats/spellcasting/` and offered by each class's trait.
- **The wizard** (Player Core): Intelligence, arcane prepared from the spellbook (`spells.book`:
  10 cantrips and five 1st-rank spells, two spells a level, the curriculum's). The seven arcane
  schools: the curriculum to 9th rank (`spells.curriculum`), its extra slot per rank and cantrip
  (the `curriculum-slots` constraint), the school spell (force bolt, charming push, earthworks,
  fortify summoning, protective wards, scramble body, hand of the apprentice); unified magical
  theory's bonus feat, extra spell and a drain per rank. The five theses (Experimental
  Spellshaping's feat, Spell Substitution's action, Spell Blending's trades asked by
  `prepare-spells` (inputs per rank the slot counts read); Improved Familiar Attunement
  and Staff Nexus text). Split Slot: `prepare-spells` may put a second
  spell in one slot below the highest rank, its copy naming the first's (`split`); casting either
  expends both. Drain Bonded Item is an action (the ranks drained today, `bondDrained`, and
  Linked Focus's `linkedFocusUsed` are Arcane Bond's saved grant state, which `daily-preparations`
  clears). Feats: Counterspell (the expending),
  Linked Focus and twelve more, text where they shape a spell's range, area or traits.
- **The cleric** (Player Core): Wisdom, divine prepared, and the divine font's 4 to 6 extra slots
  of heal or harm at the highest rank (to 9th), which `prepare-spells` fills. The deity is the
  player's own (the setting's deities are Reserved Material): the class's choices give its font,
  sanctification (none, holy or unholy, a trait), divine skill and favored weapon (its kind, then
  the weapon, trained at `attacks.favoredRank`); its added spells, edicts and anathema are text.
  The cloistered cleric and the warpriest carry the proficiency progression (the warpriest's
  armor, Shield Block and Deadly Simplicity). Feats: 24, Domain Initiate granting the chosen
  domain's spell (all 37 Player Core initial domain spells, about half resolved by `cast-spell`);
  Premonition of Avoidance, Raise Symbol, Emblazon Armament and Divine Weapon as situational
  choices; Versatile Font lets the font's slots hold either spell; Healing Hands, Harming Hands
  and Deadly Simplicity step their dice; cry of destruction's larger dice are
  text. Panic the Dead, Cast Down (the situational choice `castDown`), Sap Life and Communal
  Healing add changes to `cast-spell`'s `spell.target` and `spell.caster` steps,
  by each target's outcome (a flag per target).
- **The sorcerer** (Player Core 2): Charisma, spontaneous, the tradition its bloodline's. The ten
  bloodlines: two skills, the gift spells to 9th rank in the repertoire (`spells.granted.*`
  leave the picks out), the initial bloodline spell (all ten as spells) and blood magic, an
  action whose options each bloodline adds, offered by `cast-spell` after a bloodline spell or a
  gift spell cast from a slot (`sorcerer.gifts`; an `offerFollowUp` the blood magic feature adds
  to the `spell.paid` step). The gift spells are granted, so they can be cast. The
  draconic exemplar and elemental influence are the bloodline's own choices. Sorcerous Potency
  is a status bonus of the rank on a slot cast's damage and healing. Feats: 15, Bleed Out,
  Propelling Sorcery, Energy Ward, Advanced and Greater Bloodline and the Evolutions' skills modeled. Divine
  and Primal Evolution's extra slot of the highest rank (`spellSlots.extra`): the feat
  grants its two spells and adds its option to `cast-spell`'s `spell-cost` step, which casts
  them at the highest rank even outside the repertoire. Arcane Evolution's daily signature spell
  is a `daily-preparations` step; its Learn a Spell part and Occult Evolution add a spell to the
  repertoire for the day (`add-spell`), which the feat grants.
- **The druid** (Player Core): Wisdom, primal prepared, Shield Block, Druidic (a secret
  language the bonus-language choice leaves out), voice of nature. The four orders: a skill, the
  order's feat, its focus spell (heal animal, cornucopia, tempest surge, untamed shift) and the
  order for feats' prerequisites; Order Explorer and Order Magic reach another order. Feats: 23,
  Poison Resistance, Current Spell and Grown of Oak modeled; animal companions,
  familiars and battle forms are text. Anathema is text.
- **The bard** (Player Core): Charisma, occult spontaneous (two slots a rank, three from
  the next level), the muses (enigma, maestro, polymath, warrior: a feat granted and a 1st-rank
  spell in the repertoire beside the picks, `spells.bonusKnown`), composition spells (counter
  performance and courageous anthem, a Focus Point), Bardic Lore's field, Well-Versed (a
  situational choice), magnum opus (a second 10th-rank slot, `spellcasting.extraRank10`). The
  composition spells: courageous anthem, rallying anthem, song of strength, allegro and triple
  time apply their effects; soothing ballad heals; pied piping and dirge of doom apply their
  conditions; the rest are text. Feats: Reflexive Courage is a reaction Strike, Vigorous Anthem's temporary Hit Points,
  Eclectic Skill's untrained bonus, Deep Lore's picks, Multifarious Muse (another muse's feat),
  Perfect Encore, Inspirational Focus (refocus regains every point, `focus.refocusAll`) and
  Ultimate Polymath (every repertoire spell signature, `spellcasting.allSignature`).
- **The oracle** (Player Core 2): Charisma, divine spontaneous (three slots a rank). The
  eight mysteries: a skill, granted spells to 6th rank in the repertoire beside the picks, the
  initial revelation spell and its Focus Point, a cursebound feat granted, and the curse's
  effects, which read `oracle.cursebound` (an input from 0 to `oracle.curseMax`: 2, 3 from 11th,
  4 from 17th). A cursebound feat is an action that raises it, offered below the maximum;
  refocusing lowers it by 1 and is offered while it's above 0. 24 revelation spells
  (initial, advanced, greater); Gifted Power's extra slot for the granted spells; Divine Aegis
  and the save bonus against spells are situational choices.
- **The witch** (Player Core): Intelligence, prepared, the patron (seven) sets the
  tradition, a hex cantrip and a spell. The familiar's spells are the witch's spellbook
  (`spells.book`, which `prepare-spells` reads); lessons (basic, greater, major) give their hex,
  a Focus Point and a spell to the familiar. Thirteen hexes; Patron's Puppet, Cackle and the
  witch's armaments (eldritch nails, iron teeth, living hair as weapons). The familiar itself is
  text.
- **The champion** (Player Core 2): Strength or Dexterity, the deity's font of lay on hands
  or touch of the void, sanctification, divine skill and favored weapon (as the cleric's), seven
  causes, each with its reaction: an action that marks the target (`champion.reactionTarget`),
  applies the resistance, or Strikes (Retributive Strike). Devotion spells (lay on hands, touch
  of the void, shields of the spirit, spectral advance, champion's sacrifice, hero's defiance),
  the blessing of the devoted (armament, shield or swiftness, whose Speed applies; the runes are
  text), and the features by level
  to Hero's Defiance.
- **The alchemist** (Player Core 2): Intelligence, versatile vials (`vials`, refilled by
  daily preparations), formulas (`formulas`, a set the book picks fill), advanced alchemy (one
  infused item per vial, its level the alchemist's), quick alchemy (a vial into an item), the
  four research fields (bomber, chirurgeon, mutagenist, toxicologist), field discoveries and
  their greater ones, and bomb proficiency (`attacks.bomb`). Alchemical items (GM Core):
  eleven bomb families (39 items), seven mutagens at four grades, three elixirs (10 items) and
  29 poisons, their stages text; a bestial mutagen's claw and jaws are attacks with dice of their
  own. `throw` is a bomb's Strike: its damage, splash, persistent damage and
  condition on a hit; `drink` drinks an elixir or mutagen and applies it. Versatile vials thrown
  (1d6 to 4d6) or as healing vials. Feats: Quick Bomber, Efficient and Advanced Efficient
  Alchemy, Improvise Admixture, Mutant Physique, Regurgitate and Revivifying Mutagen modeled, the
  rest text.
- **Class feats to 20th level**: every class has every Player Core and Player Core 2 class
  feat of 1st to 20th level (910 in all, about 270 with mechanics, the rest text: other creatures, movement, timing, a spell's
  shape). A class's feat choice lists its
  own feats and those with its trait (`trait.<class>`), so a shared feat is kept once
  (`content/feats/spellcasting` for casters'); the slot's level is the choice's `eligible`.
- **Equipment:** every Player Core weapon (82 and the fist; simple, martial and advanced, every
  trait as a tag, valued traits as fields), 12 armors and explorer's clothing (check penalty and
  Speed penalty lifted by Strength; flexible armor spares Acrobatics and Athletics, noisy armor
  keeps Stealth's; bulwark is a situational choice on Reflex saves), 4 shields (the tower shield's
  Speed penalty) and 119 pieces of adventuring gear and ammunition, with Bulk and price (in gold
  pieces, `price`).
- **Runes** (GM Core; templates): weapon potency +1 to +3 and striking, greater and major
  set `potency` and `dice`; armor potency raises the armor's item bonus to AC and resilient gives
  an item bonus to saves; reinforcing runes raise a shield's Hardness, Hit Points and Broken
  Threshold to their maximums. Property runes: corrosive, decaying, flaming, frost, shock and
  thundering add their damage die on a hit; flaming's and decaying's persistent damage on a
  critical hit, fearsome's frightened, vitalizing's persistent vitality damage and enfeebled
  against undead (`undeadTarget`) and wounding's bleed come through the Strike's `strike.hit`
  steps; holy and unholy 1d4 spirit (2d4 against an unholy or
  holy target, a situational choice); keen makes a hitting natural 19 a critical hit (the roll
  tally `successToCritOn19`, as Keen Flair); shadow is an item bonus to Stealth; energy-resistant
  a resistance of the copy's chosen type; fortification raises Bulk and Strength; the rest (ghost touch, returning,
  shifting, slick, ready, and the critical hits that need the target's save or other creatures)
  are text. A copy holds one rune of each
  fundamental kind and property runes up to its potency (`rune-limits`), counted by the runes'
  kind tags (`rune.property`, …). A rune adds its price to the item's (`prior.price`); its level is in its description.
- **Consumables** (GM Core): healing potions (minor to major), elixirs of life (minor to true),
  antidotes and antiplagues, and the alchemist's bombs, mutagens, elixirs and poisons:
  `drink` spends one, rolls its healing and applies a lasting bonus
  (saves against poison or disease, situational choices) for its duration.
- **Money** (`rules/treasure.yaml`): copper, silver, gold and platinum pieces are inputs
  (`coins.cp` …), 15 gp to start; `coins.total` is their worth in gold, and 1,000 coins are 1
  Bulk. `buy` picks a kind of item and the item and pays its Price (copper first, then silver,
  gold and platinum, the change in the coins below the last one paid); `sell` removes a copy for
  half its Price (its runes' included).
- **Investiture**: `invest` and `divest` set a worn item's `invested` state; an item with
  the invested trait works only while worn and invested. Ten items at once (`investiture-limit`;
  twelve with Incredible Investiture) and ten a day (`investiture.used`, which the daily
  preparations reset). The first apex item invested (its `apex` state) raises its attribute by 1
  or to +4. Magic armor's runes make it invested: its AC works uninvested, its resilient and
  property runes only invested.
- **Worn and held magic items** (`worn` and `held`): 154 worn items (with the apex items,
  aeon stones, handwraps of mighty blows keeping their runes on unarmed attacks, companion,
  cursed and intelligent ones) and 54 held items (with artifacts and structures), each with level,
  Price, Bulk, usage and its main activation's cost and frequency. Item bonuses to skills, skill
  actions, Perception, AC, saves and Speed, resistances, senses, climb and swim Speeds, Bulk
  limits and innate cantrips are effects; an activation that casts a spell is the item's option on
  `cast-spell` (its daily use, `used`, its own rank and DC); some activations apply the item
  itself for a duration. 127 of the 208 have mechanics; the rest are text.
- **Item casting**: `cast-spell` casts a spell picked on or granted by a carried item
  (its `entry` the item's copy, its `source` the spell), paid by the item's option or not at all
  (`no-use`). Scrolls (1st to 10th rank) and magic wands hold a spell of their rank or lower,
  picked on the copy, on the list of a tradition one of the caster's sources has; a scroll is
  used up, a wand casts once a day and once more overcharged (DC 10 flat check: broken on a
  success, destroyed on a failure). Staves (15 kinds, 54 items) grant their spells and list them
  by rank; `prepare-staff` gives charges equal to the highest rank of any source's slots (plus a
  prepared spell's rank the caster expends), one staff a day; a spell costs its rank in charges,
  or 1 charge and a slot of its rank for a spontaneous source of its tradition. These ways of
  paying are the staff, wand and consumable types' options, written once. Specialty wands (widening, continuation) hold the spells they can; their change to the
  spell is text.
- **Talismans, oils, ammunition, potions and snares**: 255 more consumables. `activate`
  uses one, rolls its healing and applies it when lasting; talismans are affixed (`affix`) to the
  armor, weapon or shield they name and work from an equipped item; an applied one keeps the copy
  it is about (`copy`), so a potency crystal's bonus is the affixed weapon's and an oil of
  potency's the weapon's or armor's it was put on. Potions and talismans that
  give a spell's effect apply the spell; potions of flying, swimming and resistance (by energy),
  bravo's brew, sea touch and others are applied effects. `spring-snare` rolls a snare's damage
  and each creature's basic save. Ammunition and talismans' effects on a target are text.
- **Specific magic weapons, armor and shields**: 60 items that extend their base and keep
  their runes and material as templates, their Price their own (`keepsFields`); specific shields have their own Hardness, Hit
  Points and Broken Threshold. Precious materials are templates by grade (43), and the remaining
  27 property runes are templates as the others.
- **Extradimensional storage**: a spacious pouch, sleeves of storage or retrieval belt
  holds Bulk (`capacity`, `capacityItems`); `store` and `retrieve` move a copy in and out, and
  stored copies don't count toward Bulk. An overfilled container is a rules issue of its own
  (`container-capacity-held`, `-worn`). The winged runes' flight is an effect their
  activation applies.
- **Archetypes** (`rules/archetypes.yaml`, `content/archetypes`,
  `content/feats/archetype`): every archetype of Player Core and Player Core 2, the sixteen
  multiclass archetypes and Player Core 2's 35 general ones (51, with 331 feats). Archetype feats
  take class feat slots (every class's feat choice offers them; those with the skill trait are
  skill feats too), and an archetype's additional feats (78, fighter or monk feats an archer or
  martial artist takes) are offered at their archetype level. The dedication rule: a dedication
  is offered only while no other archetype is open (held with fewer than two other feats of
  its archetype, `archetypes.open`), and the constraint `dedication-lock` reports a sheet that
  breaks it; a multiclass dedication needs another class. Multitalented's dedication may be open
  beside another (`archetypes.openAllowance`). Basic Maneuver and its kin pick a 1st-
  or 2nd-level feat of the class, Advanced Maneuver and its kin (taken more than once, each time
  counted toward the archetype) one of up to half the level. Numbers per class
  (`rules/class-numbers.yaml`): a multiclass dedication trains its class's class DC
  (`classDc.<class>.value`, the class's key attribute), which that class's feats read; a class
  feat's prerequisite that stands for a class feature reads the class level
  (`classLevel.<class>`, half the level through the archetype). Skill Mastery raises a skill to
  master and another to expert (`skills.<skill>.granted`), never the same skill in one feat (an
  exclusivity group per feat taken). Dedications train what they say, give the class features they name (Hunt
  Prey, Rage, powerful fist, panache, on the case, Quick Alchemy, sneak attack) and record the
  instinct, cause, style, muse, order, mystery, bloodline, patron or school for its feats;
  Resiliency feats add 3 Hit Points per archetype feat; save and Perception rises, weapon
  familiarity, innate spells, granted feats, focus spells and Strikes with their extra damage or
  conditions are modeled; companions, familiars, mounts, movement and crafting are text.
- **Archetype spellcasting** (`rules/archetype-spellcasting.yaml`): a source per
  archetype that gives spellcasting, beside the class's: the values of the `archetypeSource`
  family (bard, cleric, druid, oracle, sorcerer, witch, wizard, eldritch archer, and the champion's,
  blessed one's and monk's focus spells), so two spellcasting dedications are two sources. Each has
  its own tradition, prepared or spontaneous casting, attribute and rank
  (`spellcasting.archetype.<source>.*`), its spell attack modifier and DC, and slots by the basic,
  expert and master spellcasting benefits (1st to 3rd rank at 4th, 6th and 8th level, 4th to 6th
  at 12th, 14th and 16th, 7th and 8th at 18th and 20th) and breadth. A prepared source prepares
  copies whose `source` names it (`prepare-archetype-spells` with the source; the wizard's
  spellbook and the witch's familiar are its book); a spontaneous one has its repertoire by rank
  and signature spells (one, two or three). `cast-spell` finds the spell's source (a prepared
  copy's, the repertoire that knows it, its `source` parameter choosing among several, a focus
  spell's source, an item spell's tradition) and casts with its numbers and slots, read by key; scrolls, wands and staves accept any source of the spell's tradition.
- **Variant rules** (`rules/variants.yaml`), each an opt-in setting an app turns on for a
  table: Free Archetype (an archetype feat slot at every even level), Automatic Bonus
  Progression (attack, defense, Perception, saving throw and skill potency, devastating attacks
  as a kept template on every weapon, the attribute apex) and Proficiency without Level (every
  proficiency formula adds `proficiency.level`; untrained is −2). GM Core's Level 0
  Characters aren't modeled; the pack leaves hooks a variant pack may use: `level` may be 0, and
  creation needs a class only while `creation.needsClass` holds. **Ancestry Paragon** and
  **dual-class characters** aren't offered at all: their only source is the pre-Remaster
  Gamemastery Guide (pg. 192–194, Open Game License v1.0a), not GM Core, and no pack carries
  them. The class type's copy limit is `classes.max` (1).
- **Afflictions** (`rules/afflictions.yaml`, `content/afflictions`): 63 in all: every poison,
  goblin pox, the spider sting spell's venom, curse of death, the serpent dagger's venom and GM Core's 14 diseases and 16 curses, each
  applied to the afflicted character with its stage, DC and whether it was re-exposed. Each
  stage's conditions are its grants at the stage's values and its damage its
  fields. `expose` gives a poison's affliction to a target at stage 0; a spell's affliction
  starts at the stage its outcome gives. `affliction-save` (the entry's action, the app's at
  each interval) moves the stage by the degree, ends it at 0 and deals the new stage's damage.
  Onset, intervals, maximum duration and virulence are the app's. A curse without
  stages is one stage, its effect text unless it
  is a condition (curse of slumber, reviling earth); up to 7 stages. GM Core's 7 item curses are
  templates, one per curse whatever the kind of item (`content/item-curses`), bloodbiter's bleed with mechanics.
- **Hero Points**: an input, 1 to start, at most 3; spending them is the app's.
- **Creation**: a guided start, `standard`, and a random one,
  `random`. Guided: an ancestry and its heritage, a background and a class, then what each brings in the book's order: the ancestry's
  boosts and the heritage's choices, the background's boosts (and a scholar's skill), the four
  free boosts, the class's key attribute, its skill, its trained skills (3 + Intelligence, each
  one not trained yet, counted with the free boosts in) and its feat; then the rest (the ancestry
  feat, languages, a training freed by a skill trained twice), and full Hit Points. While being created the character needs an
  ancestry, a background and a class (`creation-ancestry-background-class`); it never has more
  than one of each (the content types' `copies: { max: 1 }`), created or not.
  - **Random** (`random-character`): the rules have players choose, so the odds are the pack's. The same picks in the same order, each drawn by the engine uniformly among the
    options eligible then (`random`): the ancestry, its heritage, the background
    and the class, then every pick they bring (heritage feats, the key attribute, trained
    skills, feats, languages, a freed training). One difference: the four free boosts come
    after the class's picks, so a choice that sets the key attribute (a rogue's racket) is made
    before they're placed; a trained skill the final Intelligence adds is drawn with the rest.
    Boosts follow a priority instead. An ancestry
    takes its standard boosts (the book's default). The key attribute is planned with the
    class: the class's own (a barbarian's Strength), else Strength or Dexterity, a d2 deciding;
    the class's key attribute pick takes the planned one when it is offered (a rogue other than
    a ruffian can't take Strength: that pick is drawn among Dexterity and the racket's). Every
    boost goes to the first the choice offers of the key attribute
    (the actual one once picked, else the planned one), Constitution, Dexterity, Wisdom,
    Strength, Intelligence and Charisma, so the key reaches +4 when every source can boost it.
- **Spellcasting** (`rules/spellcasting.yaml`): a caster class sets its tradition,
  prepared or spontaneous casting, attribute, slots per rank and cantrips, and raises
  `spellcasting.rank`; the spell attack modifier and spell DC follow (one pair, tagged with the
  attribute by a computed tag as the class DC is), and innate spells use Charisma. A
  curriculum's slots, a divine font's and spells a class grants a repertoire are the class's to
  set. Slots by rank follow the full casters' table (a 10th-rank
  slot at 19th). Prepared spells are copies, one per slot with its rank, expended once cast
  (`prepare-spells`); a spontaneous repertoire is picks by rank (`features.spellcasting.repertoire`,
  each slot's pick granted into its rank's set), with signature spells cast at any rank
  from their own. Focus spells spend Focus Points (at most 3; `refocus`, `daily-preparations`).
  Cantrips and focus spells are heightened to half the level rounded up. `cast-spell` pays,
  then resolves: a spell attack per target (`spell-attack`, with the multiple attack penalty,
  doubled on a critical hit), or one damage roll and each target's save on its own sheet (none,
  half, full or double by the degree), incapacitation, heightening (+N), persistent damage,
  conditions by the outcome, healing for allies, and the spell itself applied to the caster, an
  ally or a target, its effects reading its rank (heightening to a given rank).
- **Spells:** the 41 Player Core cantrips (with the bard's compositions and the witch's hexes)
  and every 1st-, 2nd- and 3rd-rank spell (58, 55, 34), text in `i18n/en/spells.yaml`; the
  casters' 1st-rank focus spells (7 school, 37 domain, 10 bloodline and 5 order spells), text in
  their class's file. Every spell of 4th to 10th rank (33, 39, 24, 20, 15, 12, 10), 68 of
  the 153 with mechanics, and the advanced focus spells (7 school, 37 domain, 20 bloodline, 4
  order and 13 qi spells, 38 with mechanics), text in `i18n/en/spells-high.yaml`. Battle forms
  (`rules/battle-forms.yaml`) give their temporary Hit Points, skill floors and
  resistances, their AC (the form's + the level, without the armor's item bonus), and the chosen
  form's Speeds and unarmed attacks (cast-spell's `form`; 39 forms, 60 attacks as standard
  copies), whose Strikes roll the form's attack modifier or the character's own if higher and
  the form's damage bonus; fly, climb and burrow Speeds are fields (`speed.fly`, `.climb`, `.burrow`);
  regenerate and malignant sustenance heal at the start of the turn (`turn.start`). Text-only
  spells are utility, summoning, counteracting, areas over time,
  damage by outcome no table says (massacre), a save inside a hit (disintegrate) and seven
  components (cataclysm). Save damage tables, untyped damage, dice by actions and conditions that
  change with rank are fields. Player Core 2's spells: its 7 cantrips and
  76 spells of 1st to 10th rank, with their damage, healing, persistent damage and conditions by
  the save where the spell fields say them (35 of the 83), text in `i18n/en/spells-pc2.yaml`. The
  ranger's 11 warden spells are granted by Initiate, Advanced, Masterful and Peerless
  Warden (each repeatable, each spell once, and a Focus Point); a ranger's warden spells are
  primal with Wisdom, trained, expert from 9th and master from 17th. In all: 48 cantrips, 377
  spells of 1st to 10th rank (72, 68, 45, 44, 50, 29, 23, 19, 16, 11) and 205 focus spells.
- **Rituals** (`rules/rituals.yaml`): Player Core's 19 and Player Core 2's 13 as the
  `ritual` type (rank, casting time, the primary check's skills and rank, secondary casters; cost
  and secondary checks as texts), text in `i18n/en/rituals.yaml` and `rituals-pc2.yaml`. `perform-ritual` is the primary check against the GM's
  DC (or the very hard DC for twice the rank), the secondary checks' results given as counts; a rank above half the level is refused. Each outcome's effects are text.
- **Leveling:** 1,000 experience offers `level-up` (a derived offer while it holds), which raises the level (Hit
  Points follow), spends the experience, gives a skill increase at 3rd and every odd level after
  (over the increases inputs, each within its `max`), and asks what the new level brings over the pending choices.
- **Sheet layout**: field groups (character, attributes, defenses, saves,
  skills, proficiencies, Bulk, the turn), action groups (Strikes, checks, reactions, turns,
  conditions and afflictions, class and feat actions, skill actions, exploration and downtime,
  spellcasting, inventory, advancement) and content groups (conditions and effects applied,
  ancestry, heritage, background, class, class features, feats by category, spells, weapons,
  armor, shields, gear, consumables, worn and held items, staves, wands, rituals; the boosts and
  languages picked in background groups); names for weapon traits. Every action and content type
  has a group; a template on a copy (a rune, automatic bonus progression's devastating
  attacks) shows with its copy.

## Coverage

| Area                  | Built                                                                                                                                                                                            | Not modeled                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Core math             | Attributes, proficiency, skills, saves, Perception, AC, class DC, HP; the highest resistance and weakness; damage immunities                                                                     | —                                                                       |
| Checks                | Degrees of success, flat checks, fortune and misfortune, typed bonuses, 55 skill actions, Hero Points                                                                                            | Spending Hero Points (the app's)                                        |
| Strikes               | MAP, every weapon trait, runes, criticals, flat checks, damage                                                                                                                                   | Critical specialization, reload, critical hits that need a save         |
| Conditions            | All Player Core conditions, dying and recovery, turns                                                                                                                                            | Attitudes, detection states as observer-relative                        |
| Ancestries            | 16 ancestries, 106 heritages (7 versatile), 313 ancestry feats (1st to 17th), 90 versatile heritage feats                                                                                        | —                                                                       |
| Backgrounds           | All 64 of Player Core and Player Core 2                                                                                                                                                          | —                                                                       |
| Classes               | All 16 of Player Core and Player Core 2, 1–20, with every class feat                                                                                                                             | Animal companions, familiars and eidolons as creatures                  |
| Spellcasting          | Traditions, prepared and spontaneous, slots, focus, innate, cast-spell, spellbook, curriculum, divine font, scrolls, staves and wands; a source per spellcasting archetype                       | —                                                                       |
| Spells                | 48 cantrips, every spell of 1st to 10th rank (377), 205 focus spells, 32 rituals (Player Core and Player Core 2); afflictions with stages (poisons, GM Core's diseases and curses)               | Summoned creatures (the app's)                                          |
| Feats                 | 31 general, 154 skill (all of Player Core and Player Core 2)                                                                                                                                     | —                                                                       |
| Archetypes            | All 51 of Player Core and Player Core 2 (331 feats, 78 additional feats), the dedication rule                                                                                                    | Companions, familiars, mounts as creatures                              |
| Equipment             | 99 weapons, 12 armors, 4 shields, 119 gear, 72 runes, 43 materials, 284 consumables, 106 alchemical items, 208 worn and held items, 54 staves, 53 wands, 60 specific items, 7 item curses, money | Companion items, GM Core's relics and vehicles                          |
| Creation and leveling | Guided and random creation, level-up with boosts, increases and feat slots; Free Archetype, ABP, Proficiency without Level                                                                       | Level 0 characters (GM Core); not offered: Ancestry Paragon, dual-class |

## Rule readings

Where the books leave a rule open, or the format needs a choice the books don't make, the pack
reads it as below. These are the pack's provisional calls; a table may rule otherwise.

- **Random start:** the books have players choose, so the odds are the pack's. Each pick is
  drawn uniformly among the options eligible then, in the guided start's order, except that
  the free boosts follow the class's picks, once the key attribute is known. Boosts follow a
  priority instead: an ancestry takes its standard boosts; the key attribute is planned with the
  class (its own, else Strength or Dexterity on a d2); every boost goes to the first offered of
  the key attribute, Constitution, Dexterity, Wisdom, Strength, Intelligence and Charisma.
- **Free Archetype:** a slot can be left with no eligible feat (an archetype whose remaining
  feats need skills the character lacks, with the dedication rule closing the others). It stays
  a pending choice the rules leave empty, not a rules issue.
- **Core:** Shield Block applies to any damage while the shield is raised (the player says it's
  physical); persistent damage applies the full roll, and its flat check is DC 15 for everyone;
  skill increases come at odd levels from 3rd unless a class gives more; current Hit Points
  don't rise on a level-up; a skill increase on an untrained skill trains it, and that training
  counts as the player's choice; stunned's lost actions count toward slowed's; Bulk sums light
  items exactly and drops fractions; only the first apex item invested raises its attribute,
  and an item divested still counts toward the day's ten investitures.
- **Skill feats:** Student of the Canon's critical failure is a failure on any Religion check to
  Recall Knowledge or Decipher Writing (the player keeps it to faiths); about the player's own
  faith (the `ownFaith` situational) the check is one degree better, which is the feat's failure
  to success and success to critical success, with a critical failure already a failure.
- **Rogue, ranger and barbarian:** a ruffian's die limit reads the weapon's own die; Outwit's
  bonus to Recall Knowledge applies to any skill check against the prey; ending a rage sets
  temporary Hit Points to 0; a dragon instinct names its dragon by its breath damage type; a
  superstition barbarian's Raging Resistance traditions are a choice whose resistance the player
  applies.
- **Monk, swashbuckler and investigator:** a bravado check is any skill check the player calls
  bravado; Confident Finisher halves the rolled finisher dice; Extravagant Parry's +2 is the
  default (the player says when it's +1).
- **Casters:** the cleric's deity is the player's, any font with any sanctification, and Domain
  Initiate offers every domain; the divine font's rank stops at 9th; blood magic's rank defaults
  to half the level rounded up; Sorcerous Potency applies to every damage roll of a slot cast,
  once per target; tempest surge's clumsy applies on a critical failure too; cornucopia's
  healing is rolled when cast; Order Magic offers explored orders only; a muse's spell and a
  mystery's granted spells join the repertoire beside the picks; the oracle's cursebound value
  is the player's input, which cursebound actions raise; a champion's cause is offered by its
  sanctification (holy or unholy causes, or either for none); a versatile vial's dice step at
  3rd, 11th and 17th level.
- **Archetypes:** an archetype's count includes its additional feats the character has once its
  dedication is held; a dedication's "trained in X, or a skill of your choice" is a training like
  a background's (one already trained frees a training); "expert in X if already trained" is the
  training, the expert rank the player's increase; the barbarian archetype's Rage uses the rules'
  2 damage; a warden spell taken through an archetype uses innate numbers (Charisma, trained);
  Sentinel Dedication's and Champion Dedication's heavy armor count the class's light and medium
  armor, or the other dedication's, as "already trained"; Elemental Fist's prerequisite is Qi Spells.
- **Afflictions:** a poison delivered before its first save is stage 0, which any success ends;
  a curse without stages is one stage, which a successful save ends when the app offers one.
- **Player Core 2's options:** Robust Health's Hit Points aren't doubled by an hour's care;
  Draconic Resistance's damage type is an optional choice that counts only with a physical
  exemplar; the amnesiac's third boost is a free one; settlement, city and deity Lores are the
  first Lore of the player's choice.
- **Variants:** skill potency's cap holds when a pick is offered (a saved pick stays eligible;
  the `skill-potency` constraint reports a total over the level's cap).

## Limitations

- **Out of scope:** animal companions, familiars, eidolons and mounts as creatures of their own
  (Player Core's companion types, specializations and advanced options, and the familiar and
  master abilities: a creature the character keeps isn't a sheet the pack can feed), GM Core's
  relics and vehicles, Ancestry Paragon and dual-class characters (their only source is the
  pre-Remaster Gamemastery Guide), and GM Core's level 0 characters (`level` may be 0 and
  `creation.needsClass` is a hook a variant pack may use).
- **Left to the app:** turns (it runs `start-turn` and `end-turn`), movement and reach, who is
  flanked or in cover (situational choices), when a condition is gained (`applyEffect`), daily
  preparations (the pack's `daily-preparations` and `prepare-spells` say what happens), rests; a
  spell's duration, sustaining and dismissing it, its area and who is in it (an applied spell
  stays until the app removes it, but one for the next roll, such as guidance, sure strike,
  true target or weapon surge, ends on the roll it changes; a spell on "you and your allies"
  takes the caster as an ally too); summoned creatures; onset, intervals and virulence of
  afflictions.
- **Text only:** critical specialization, armor specialization, the skill feats that change
  time, other creatures or what the GM tells you (58 of 106), the skill actions' movement,
  attitudes and detection toward one observer, innate spells from heritages, Lunge; the rogue's,
  ranger's and barbarian's feats about movement, skill actions, companions and spells; Deny
  Advantage; Master Strike; monk weapons, skill actions that are bravado (the bravado check
  stands in), the finishers' rule against later attacks, five styles' Exemplary Finisher
  effects, Recall Knowledge feats; half damage on a failed save; more than half the spells
  (utility, summoning, counteracting, illusions, areas over time; battle forms' senses, reach and
  riders); the rituals' outcomes; what a rune or feat does to a Strike's target that needs its
  save; Multitalented's waiver for an aiuvarin; Ancient Elf's dedication (at creation the
  heritage's choice comes before any boost, so no dedication's attribute prerequisite could be
  met); charhide goblin's fire and Scar-Thick Skin's bleed persistent damage.
- **Lore:** the Lores the backgrounds train (38, with six terrain Lores) and the 16 ancestry
  Lores are fields (`rules/lores.yaml`, `rules/lores-pc2.yaml`, `rules/ancestry-feats.yaml`);
  any other Lore is a homebrew increases input and a trained-by-increase input (tagged
  `skill-increase`, they join level-up) and rank and modifier fields, trained by a homebrew
  effect granting its tag into `skills.trained`. The class's free skills and `extra-training`
  offer the first seven Lores only: their lists are written out, as no formula lists fields by tag.

## Sources

- **Rules:** Player Core, Player Core 2 and GM Core (Remaster), as presented by Archives of
  Nethys (2e.aonprd.com), the official free rules reference, and checked against its Remaster
  entries item by item. Player Core weapons Archives of Nethys now files under a later book
  (katana, wakizashi, the monk weapons, shortbow, composite longbow, heavy crossbow, glaive and
  others) are included. Nothing from the pre-Remaster (OGL) books.
- **ORC License:** the notices it requires, from the license's text (paizo.com/orclicense); the
  attribution lines as Archives of Nethys lists them.
