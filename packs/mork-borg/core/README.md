# MÖRK BORG

An **unofficial, mechanics-only** Open Character Format pack for the MÖRK BORG core rules, for
apps that keep MÖRK BORG character sheets: the six core classes and the classless character,
abilities and tests, omens and powers, the starting weapons, armor and scrolls, the Occult
Herbmaster's decoctions, the class companions, random and guided character creation, and getting
better. It carries no rules text, no flavor text, no art, no logo and no claim to be official.
The text in `i18n/en.yaml` is names and short labels written for this pack.

MÖRK BORG is ©2019 Ockult Örtmästare Games and Stockholm Kartell. The Open Character Format
MÖRK BORG pack (mork-borg-core) is an independent production by pixelqueue and is not affiliated
with Ockult Örtmästare Games or Stockholm Kartell. It is published under the
[MÖRK BORG Third Party License](https://morkborg.com/license/). MÖRK BORG is copyright Ockult
Örtmästare Games and Stockholm Kartell.

## License

- **Metadata:** `mechanics-only`. The license's required notices (above) are in the manifest, so
  apps pass them on to their users: the copyright line is the pack's `credit`, and the
  independent-production statement its `not-affiliated` notice.
- **Terms:** [`LICENSE`](LICENSE) gives the pack's terms: the contributors' own work in it is under CC0 1.0 (the repository's default for packs), with the notices above.
- **What the Third Party License allows:**
  - Anyone may publish material based on MÖRK BORG, free or paid, without asking.
  - The mechanics and rules may be reused freely.
  - The names of creatures, locations and entities of the game world may be used.
- **What it forbids:**
  - Reusing or translating the books' art and text without permission.
  - Using the publishers' logos.
  - Suggesting the product is official or endorsed.

## Install and load

```sh
pnpm add @opencharacter/engine @opencharacter/mork-borg-core
```

```ts
import { computeSheet, loadRuleset, type CharacterFile } from '@opencharacter/engine';
import morkBorg from '@opencharacter/mork-borg-core';

const loaded = loadRuleset([morkBorg]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

const scvm: CharacterFile = {
  specVersion: '0.3.0',
  id: 'scvm',
  packs: [{ id: 'mork-borg-core', version: '0.2.0' }],
  values: { 'mork-borg-core:abilities.strength': 1 },
  features: [{ id: 'class', item: 'mork-borg-core:classes.fanged-deserter' }],
};

const sheet = computeSheet(loaded.ruleset, scvm);
sheet.values['mork-borg-core:load.capacity']?.value; // 9 (Strength + 8)
```

The English text is `@opencharacter/mork-borg-core/i18n/en`. To make a new character instead,
start a character with `creating: true` and run one of the creation starts below (`guided`,
`class` or `classless`) with `startAction`.

## What's modeled

- **Abilities:** Strength, Agility, Presence, Toughness, from −3 to +6.
- **Character sheet:**
  - HP (0 is broken, below 0 is dead).
  - Omens (with the class's omens die) and power uses, both as today's total and what's left.
  - Silver, starving and infected flags, the days without food, a hemorrhage's hours left, and
    two timed states from decoctions (Fernor's Philtre, berserk) that the app clears when they
    end.
  - Carrying capacity (Strength + 8) and the items carried: the weapons, armor, shields,
    ammunition, scrolls and decoctions in the inventory, plus other items the player counts.
    More than the capacity is encumbered.
  - Armor tier.
- **Tests:** `test` rolls d20 + an ability against a DR (12 by default).
  - A natural 20 is a crit and a natural 1 a fumble, whatever the total.
  - Omens: spending one before a test lowers the DR by 4 (situational choice `omen`). After a
    failed test, an omen can reroll it or turn a fumble into a plain failure (the `fate` choice).
    After a failed defense, an omen takes d6 off the damage (the `ward` choice). Both choices
    recommend not spending, so they only stop the action when the app's policy pauses on them.
  - DR penalties: medium and heavy armor make Agility tests +2 and +4 and defense +2. Being
    encumbered makes Strength, Agility and defense tests +2. Some classes change these too.
  - In a hemorrhage every test is at least DR16 in the first of two hours and DR18 in the last
    (`condition.hemorrhage`, which the broken roll sets and the app counts down).
  - From other characters: a Speaker of Truths' clarity (`tests.truth`) makes the next
    test 4 easier, and the Horn of the Schleswig Lords (`tests.horn`) the next non-combat test a
    success (a crit stays one); each is used up by the test. The situational choices `invisible`
    (Metzhuotl Blind Your Eye: attack and defense at DR6) and `grace` (Grace for a Sinner: +d6
    on one test or damage roll) are offered on every sheet, since a scroll someone else read
    brings them.
- **Classes:** the six core classes (Fanged Deserter, Gutterborn Scum, Esoteric Hermit, Wretched
  Royalty, Heretical Priest, Occult Herbmaster) and `classes.classless` for a character without
  one. Each carries:
  - its ability dice, hit die, omens die, starting silver and starting weapon and armor dice;
  - its fixed numeric features: the Deserter's Agility penalty, scroll ban and bite; the Scum's
    easier Presence and Agility tests; the Priest's powers in medium armor;
  - its d6 feature table as a choice (`feature`) of named options: one pick, two different
    picks for the Royalty, and one or two for the Scum, which rolls a second specialty the first
    time it gets better (`get-better`, below). Features that are weapons (the Brown Scimitar, Old Sigûrd's Sling, the
    Shoe of Death's Horse, the Blade of Your Ancestors, Eurekia, the Snake-Skin Dagger, the
    Sacred Shepherd's Crook) are items in `content/weapons`, which creation adds with the pick.
    Features that are companions are below.
- **Class features in numbers** (`rules/features.yaml`): each feature's option sets a
  hidden flag, and its actions are offered while it is set. Uses per day come back with
  `new-day`.
  - Fanged Deserter: Wizard Teeth (`rattle-teeth` before battle, a d6 a tooth; each 6 a charge
    the situational choice `teeth` spends on a hit for maximum damage). The Brown Scimitar's
    1-in-6 sepsis on a hit and the Shoe of Death's Horse's 1-in-6 smashed skull are outcome data
    (`sepsis`, `skullSmashed`): the 10 minutes and the creature's size are the app's and GM's.
  - Gutterborn Scum: Coward's Jab (a weapon action: DR10 Agility, then damage + 3; an omen on
    the hit, `omenDamage`, makes the weapon's die its maximum), Filthy
    Fingersmith (`fingersmith`, DR8 Agility), Abominable Gob Lobber (`gob-lob`: DR8 Presence; a
    hit blinds for d4 rounds and hands each witness a Toughness test, `ally` DR10 and `enemy`
    DR12), Escaping Fate (a follow-up on each omen spent lists `escape-fate`, a d2 per omen, a 1
    giving it back) and Dodging Death (a follow-up on death lists `dodge-death`: a d2 of 1 and
    the scum is back after 10 rounds with d4 HP).
  - Esoteric Hermit: Master of Fate (`find-the-way`, DR8 Presence), A Book of Boiling Blood
    (`boiling-blood`, once a day: d2 slayers, a d6 of 5–6 turning them; the enemy's DR12 test is
    the GM's), Speaker of Truths (`speak-truth`, twice a day, to a `recipient`), Initiate of the
    Invisible College (`invisible-college`, once a day: d2 scrolls of a d4's kind, each a d10
    on that kind's scroll table in the book's order, added as `summoned` copies that one use or the
    next `new-day` removes).
  - Wretched Royalty: the Snake-Skin Dagger kills on a damage roll of 1 (`poison`, the target's
    HP set below 0); the Horn (`blow-horn`, once a day: DR12 Presence, then the `recipient`'s
    next non-combat test succeeds).
  - Heretical Priest: the Stolen Mitre's defense DR10 (worn, as the pack assumes), List of Sins
    (`read-sins`, DR10 Presence, and the situational choice `sinner`, +2 to defend against a
    revealed creature), the Nechrubel Bible (`read-bible`, once a day: even, the day's rests heal
    faster; odd, d3 hallucinations), the Stones of Thel-Emas (`cast-stones`, DR10 Presence; a
    failure silences them until the next `new-day`).
- **Companions:** the Fanged Deserter's Ancient Gore-Hound, the Esoteric Hermit's hawk,
  and the Wretched Royalty's Poltroon the Court Jester, Barbarister the Incredible Horse and
  Hamfund the Squire.
  - **Their own sheets:** each is a character file of this pack holding a `companion` item
    (`content/companions`) instead of a class. The `companion` creation start
    (`create-companion`, optionally given the companion) adds it and sets its HP: 10 for the
    hound, 8 for the hawk; the source gives the Royalty's three none.
  - **Attack and defense:** `companion-attack` is a d20 against the companion's attack DR, no
    ability (10 for the hound and the hawk), for its damage (d6, d4); a crit doubles it and the
    target's worn armor drops a tier. The hawk defends at DR 10, the hound at 12; `defend`,
    `broken` and `rest` work as for anyone. A companion's sheet shows only its condition, rolls
    no omens or power uses, can't use powers and doesn't get better.
  - **The owner:** a link slot per companion (`hound`, `hawk`, `poltroon`, `barbarister`,
    `hamfund`) reading its HP. Picking the feature sets a hidden flag, and while that companion's
    slot is empty a finished sheet is offered its sheet: an optional derived offer
    (`<slot>-sheet`) naming the slot and the `companion` start with the
    companion. The app makes the file, runs the start and saves the link, which ends the offer;
    declining leaves the companion on the flag. Not offered while creating, so a random start
    finishes.
  - **Poltroon:** the situational choice `poltroon` adds 2 to the tests of `attack`, `defend`
    and the bite, which run `test` tagged `attack` or `defense`; it is offered on
    those rolls only. **Barbarister:** `barbarister` lowers a Presence
    test's DR by 2. Both are offered while the feature is picked and a linked companion has HP
    above 0. The jester helps the owner's allies too: `poltroonAlly` (+2 on attack and defense)
    is offered on every other sheet, as 5E's Bardic Inspiration is.
  - **Hamfund:** Eurekia is `cursed`: each attack with it rolls a d6, and a 1 sets the linked
    Hamfund's HP to −1 (dead) and removes Eurekia.
- **Decoctions:** the Occult Herbmaster's eight, as `decoction` items whose quantity is the
  doses.
  - `brew` (on the class) rolls the day's two decoctions (the d8 table) and d4 doses, asks how
    many go to the first (half, rounded up, recommended) and adds the copies.
  - `use-decoction` spends a dose and rolls the decoction's numbers (damage or healing,
    duration), returned with its resisting Toughness DR and whether it cures infection. The
    dose's `drinker` participant (one at most) with a resisting DR tests Toughness
    on its own sheet (a handoff) and, failing, takes the damage (`damage.direct`: poison isn't a hit); healing heals
    it, a cure clears its infection, and Fernor's Philtre and Hyphos' Snuff set its
    `condition.philtre` (Presence tests 2 easier) or `condition.berserk` (defense DR14).
- **Character creation:** two starts, both random as in the source, and
  a guided one, run by `create-character` on a character being created that has no
  class or companion yet (it adds one, so it can't run twice). The creation actions are kept
  out of play views (`visibility: background`).
  - `guided` (`choose: true`): the player picks the class, `classes.classless` included,
    instead of the d6; everything else is rolled as below, and the feature's roll is the
    recommendation the player may change.
  - `classless` adds `classes.classless`, whose character rolls two abilities of the player's
    choice on 4d6 dropping the lowest (drawn at random in the random start; the guided one recommends
    the first two), and starts with smaller weapon and armor dice when the equipment tables give
    it a scroll.
  - `class` rolls a d6 for one of the six classes (in the ruleset's content order) and adds it.
  - Both roll each ability and read the ability table; roll HP (Toughness + hit die, at least
    1), omens, powers (Presence + d4) and silver (×10), and save them as input values.
  - They add the starting weapon and armor the rolls pick from the starting lists below (armor
    1 is none), equipped, and Presence + 10 arrows or bolts with a bow or crossbow. The Esoteric
    Hermit also gets its random scroll: a d2 for the kind, then a d10 on that kind's table in the
    book's order.
  - They roll the class's d6 feature and ask the class's own `feature` choice over its pending
    choices, the roll recommending the option in table order: two different
    ones for the Royalty (a picked one isn't offered again, and a d5 counts on from the first),
    one now for the Scum. An automatic run takes the rolls; a guided one may pick otherwise.
  - Before the weapon and armor, they roll food and the three starting-equipment tables, and add
    what they give: a waterskin and d4 days of food (a copy's quantity); the d6 table's
    container, beast or wagon; and the two d12 tables' entries. Entries the pack already has are
    those copies: a random unclean or sacred scroll (a d10 on its table in the book's order, as the
    Hermit's), red poison and the life elixir (`decoctions.elixir-vitalis`) with d4 doses, and the
    shield (not equipped). The rest are `equipment` copies, names only, with the tables' numbers:
    Presence + 4 torches, the lantern's Presence + 6 hours of oil and the medicine chest's
    Presence + 4 uses (state), d2 monkeys, the bear trap's, bomb's and crowbar's damage, the perfume's
    price. The action ends by proposing `finishCreation`; its outcome carries no data.
  - While the character is being created, it needs a class, `classes.classless` included
    (`creation-class`), on a sheet filled in by hand too. It never has more than one class or
    companion (`one-class`), created or not: a limit across two types, so a constraint
    rather than a content type's `copies`.
- **Combat:**
  - `initiative`: d6 + Agility.
  - **Crits and fumbles that double damage:** the rules' `crit-damage` doubles
    every item of a damage roll made after a crit on the action's test (`steps.check`), and
    `fumble-damage` every item of the damage a defense takes (`damage.taken`) after a fumble.
    Whatever adds to the roll (Grace for a Sinner's d6) is doubled with it. This covers `attack`,
    `companion-attack`, the Fanged Deserter's bite and Coward's Jab.
  - `attack` (weapons): Strength for melee, Presence for ranged. A crit doubles the damage and
    proposes that the target's worn armor drop a tier (a change aimed at the target's armor
    copies, which its applyChanges resolves). A fumble marks the weapon `broken`. Spending an
    omen on a hit (situational choice `omenDamage`) deals the weapon's maximum damage
    (`maxOf(item.damage)`), doubled on a crit, and proposes spending it; a Wizard Teeth charge
    (`teeth`) does the same when no omen is spent. A poisoned blade kills when its die shows 1. It reads the omens left
    after the test's (on the DR, `omen`, or a reroll, `fate`; the proposed sheet, proposal
    0046): with none left, the damage is rolled. `fate` and `ward` read them the same way.
  - `defend`: an Agility test against the attack. On a failure it proposes the attack's damage
    (a dice parameter); armor and shield come off when it is applied (below). A fumble doubles
    the damage and lowers the worn armor a tier; a crit reports a free attack back. The outcome's
    `damage` is before armor.
- **Armor:** each copy tracks the tiers it has lost (`damage`). Damage reduction follows the
  current tier; the Agility and defense penalties and the powers limit follow the undamaged tier.
  - Every hit is reduced by the worn armor's die (d2, d4, d6 by its current tier) and an intact
    shield's 1, never below 0, wherever the damage comes from: `defend`, another character's
    `attack`, or damage the app applies (adjusts tagged `damage`). They are incoming-change
    effects: applyChanges rolls the armor die with the app's dice function,
    or takes the face from the adjust's `faces`, and returns the changes with the face written in
    for the app to log.
  - Infection and a failed power's backlash are tagged `damage.direct`: they aren't hits, so
    armor and shields don't reduce them.
  - **A shield broken on purpose:** the character taking a hit may choose the
    situational choice `shieldSacrifice` on its damage adjust; the hit
    does nothing, no armor die is rolled, and the worn shield breaks.
- **Powers:** `use-power`, run from a scroll (unclean or sacred).
  - It spends a use and tests Presence against DR 12. A failure deals d2 damage to the reader;
    a fumble reports an arcane catastrophe.
  - Powers are unavailable in armor above light (medium for the Priest), with a weapon marked
    `blocksPowers` equipped, or for the Fanged Deserter.
- **Days and rest:**
  - `new-day` rolls omens and power uses, and costs an infected character d6 HP. With `fed`
    (whether the character ate) it counts days without food, sets or clears `starving`,
    and past two such days costs d4 HP (`damage.direct`). It also brings back the class
    features' uses per day and turns summoned scrolls to ash.
  - `rest`: d4 HP for a short rest, d6 for a night's sleep, nothing while starving or infected.
- **Damage and healing by hand**, on the HP tile (`rolls`) and in the `hit-points`
  group: `take-damage` (`amount`; `direct` for damage that isn't a hit) adjusts HP tagged
  `damage`, so worn armor's die and a shield reduce it and the shield can be sacrificed, or
  `damage.direct`, which they ignore; `heal` (`amount`) adjusts it tagged `healing`, up to the
  maximum. `broken` and Dodging Death are `becomes` follow-ups, so they fire from any change to
  HP, a hand edit too; only armor and shields need the `damage` tag. Each is stored once and ends
  with its state: healed above 0 or dead below it, a pending broken roll goes.
- **Broken:** `broken`, offered only at exactly 0 HP, rolls the d4 (unconscious,
  maimed, hemorrhage, dead) and its follow-up dice. Unconscious and maimed characters come back
  with d4 HP, at most their maximum (so does a scum dodging death). A hemorrhage puts its d2 hours
  on the sheet (`condition.hemorrhage`), and death sets HP below 0, which is what
  Dodging Death's follow-up reads. Reaching 0 HP stores `broken` as a required follow-up, for the app to
  run; Escaping Fate and Dodging Death are optional.
- **Items:** the core starting lists, with prices in silver.
  - **Weapons**, the d10 starting table in order: femur, staff, shortsword, knife, warhammer,
    sword, bow, flail, crossbow, zweihänder. Each has its damage die and, where it applies,
    ranged, two-handed and the ammunition it uses. The zweihänder blocks powers.
  - **Armor:** light, medium and heavy (tiers 1–3; the starting d4's 1 is no armor). A shield.
  - **Ammunition:** arrows and bolts, counted by the copy's quantity. A bow or crossbow can attack
    only while the character has arrows or bolts of its kind left, and each attack spends one,
    hit or miss, from the first copy with any left. An empty copy stays.
  - **Scrolls:** the ten unclean and ten sacred scrolls. Each lists its random numbers:
    targets, an amount (damage, healing, temporary HP, a roll bonus, distance or creatures),
    duration (some add Presence) and a resisting DR. A successful `use-power` rolls them and
    returns them as outcome data; the app applies them to each target, since the source doesn't
    say whether armor stops a power's damage or how Death's 4d10 is shared. On the target's
    side, Metzhuotl Blind Your Eye and Grace for a Sinner are the situational choices
    `invisible` and `grace` (above).
- **Getting better:** `get-better` handles everything in one action.
  - 6d10 against maximum HP for +d6 HP.
  - A d6 per ability, raising it (to +6) or lowering it (to −3; a 1 always lowers).
  - A d6 for what's found: 3d10 silver is added; a scroll is outcome data.
  - A Gutterborn Scum with one specialty rolls its second: a d5 counting on from the first in
    table order, recommending the option the player confirms or changes. Rerolling them
    on later advancements is the table's.
- **Sheet layout** (`rules/layout.yaml`): display groups for actions
  (combat, hit points, Broken only at exactly 0 HP or, for a scum with Dodging Death, below it,
  tests with the class features' tests and Escaping Fate, powers and decoctions, days and rest,
  getting better, character creation) and the inventory (class, weapons, armor, shields, ammunition,
  scrolls by unclean and sacred, equipment, decoctions, companions). Content-type hints show dice as dice,
  armor damage as dots, a broken weapon or shield only when broken, and prices in silver
  (`units.silver`); quantity is hidden except where it counts (ammunition, scrolls, weapons).

## Coverage

The sheet and the core rules are modeled. What's missing is left to the app or the table:

- **Left to the app or the table on purpose:**
  - Creating a companion's sheet and linking it; the pack offers it.
  - The clock: when timed states end (a hemorrhage's hours, Fernor's Philtre,
    berserk, invisibility, a decoction spoiling after 24 hours), the first two rounds of
    Poltroon's capering, Eurekia's once per combat and Gob Lobber's d2 spits a fight.
  - Who is where: who drinks a decoction, who witnesses a gob, who fights beside the
    jester.
  - Miseries.
  - Enemy stats and morale (the Crumpled Monster Mask, the Crucifix).
  - The rest of the list below.

## Omitted

- **Items beyond the starting lists.** Gear from the price list beyond the starting-equipment
  tables is left out, and so are the weapons beyond the d10 starting table: battle axe, mace, handaxe, club,
  whip, shortbow and sling. Arrow and bolt prices are left out because the sources'
  bundle sizes disagree. The tablets from the supplements are left out too.
- **Scroll effects in words:** what a scroll does besides its numbers (confusion, invisibility,
  questions to the dead, …) is text.
- **What class features do,** beyond their numbers: a book's slayers fighting, a mask or
  crucifix scaring creatures, hallucinations, a crook sparing the faithless, the Blade of Your
  Ancestors turning on a disappointing owner (when is the GM's), Excretal Stealth (the other
  side's DR16 test) and the Bard's +d4 on reaction rolls (the GM's roll). The Stolen Mitre's
  stealth test names no ability, so it isn't an action. The origin tables are left out too.
- **The Occult Herbmaster's first brew** isn't part of creation: the herbmaster runs `brew`.
- **Tables:** arcane catastrophes, terrible traits, broken bodies, bad habits. The
  actions return the rolls for the app to look up.
- **Behavior decided at the table or by the app:**
  - Being dizzy for an hour after a failed power.
  - Hirelings and followers other than the class companions.
  - What companions do beyond their numbers: the hound's nose and frenzy, the hawk's scouting,
    and when Barbarister cares to help.
- **Miseries.** The end of the world is campaign state, not a character's.
- **Supplement classes** (Feretory and others).

## Rule readings

Where the book leaves a rule open, the pack reads it this way:

- **Broken and dead:** the broken roll happens only at exactly 0 HP; damage that skips past 0
  kills outright.
- **Omens on a hit:** an omen spent for maximum damage (on an attack or Coward's Jab) counts only
  if one is left after any the test spent.
- **Decoctions:** a dose is one drinker's. Whether the day's two decoctions may be the same isn't
  settled; two copies of one are allowed.
- **The Esoteric Hermit's random scroll:** a d2 for the kind (1 unclean, 2 sacred), then a d10 on
  that kind's table in the book's order. The Invisible College's d4 picks sacred on 1–2,
  unclean on 3–4.
- **The Gutterborn Scum's second specialty**, rolled the first time it gets better: a d5 counting
  on from the first in table order, as the Royalty's second starting item does. Later rerolls are
  the table's.
- **The Stolen Mitre** is read as worn: defense DR10.
- **Starting equipment:** the tables are rolled before the weapon and armor, so a classless
  character knows whether it has a scroll. The donkey, the wagon, the dog and the monkeys don't
  count toward load (`load: false`); the containers don't raise it. What the dog and monkeys do
  in a fight is the GM's.

## Sources

The mechanics were checked against the free MÖRK BORG Bare Bones edition and against several
independent community sources (the Foundry VTT system's data, open-source character generators
and reference sheets). Where they disagree, this pack takes the majority:

- **Fanged Deserter HP:** Toughness + d10 (one source has d8).
- **Classless omens:** d2 (one source has d4).
- **Smaller dice with a scroll:** weapon d6 and armor d2, classless only. One source also applies
  this to classes.
- **Wretched Royalty armor:** d3, the same as the book's d4 with heavy armor rerolled.
- **Powers and heavy weapons:** the book names the zweihänder; a reference sheet says any d10
  weapon. Here it's a weapon field (`blocksPowers`).
- **Gutterborn Scum:** the easier Agility tests don't apply to defense, matching the Deserter's
  harder Agility tests, which the sources say don't. This one is unsettled.
- **Natural 20 and 1:** a crit always succeeds and a fumble always fails here. The book describes
  their effects on attack and defense but doesn't say this outright.
- **Item data:** the weapon, armor, shield and scroll lists and their prices come from the
  Foundry VTT system's compendium. The one other source (scvmgrinder) copies it, and the item
  lists weren't checked against the Bare Bones PDF. Two scroll prices (Eyelid Blinds the Mind
  and False Dawn/Night's Chariot, 20s against 50s for the rest) and the femur's 0s are
  Foundry's alone. An audit (2026-10-14) checked every class, feature, companion,
  weapon, armor, scroll, decoction and table here against that system's 2.6.2 data again.
- **Scroll tables:** the d10 order of each kind's table (the Invisible College, the Hermit's
  scroll) is Foundry's random tables'. Its unclean table lists nine; Foul Psychopomp, the tenth
  unclean scroll, is 10.
- **Companions:** the hound's and the hawk's numbers are in the class text the Foundry VTT
  system quotes. Foundry also gives Poltroon and Hamfund 1 HP, Barbarister 8 and every follower
  morale 7, which the class text doesn't; they're left out.
- **Scroll names:** the license allows the names of the game world's entities and forbids
  reusing the books' text. Scroll names are kept and nothing else of the books' wording.
- **Class features and decoctions in numbers:** from the class text the Foundry VTT
  system (2.6.2) quotes, numbers only. The pack's readings where the text is loose:
  - a "1 in 6 chance" is a d6 of 1, and a "50% chance" a d2 of 1;
  - a feature's stated DR (Fingersmith's DR8, the stones' DR10) is the base DR, so the class's
    and armor's DR changes still apply;
  - "light one-handed weapon" (Coward's Jab) is any weapon that is neither two-handed nor
    ranged;
  - the brew's doses split as the herbmaster likes, since the text gives only the total;
  - the stones fall silent until the next `new-day` (the text says until sunset);
  - starvation (d4 HP a day after two days without food) follows the earlier sources; whether a
    decoction's unstated test (Southern Frog Stew, Ezumiels Vapor) is Toughness is the pack's
    reading.
