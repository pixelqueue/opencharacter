# Fate Core

`@opencharacter/fate-core` is an [Open Character Format](https://opencharacterformat.org/) pack
for the **Fate Core System SRD** ([fate-srd.com/fate-core](https://fate-srd.com/fate-core)). It
is for apps that build, show and play Fate Core characters with an OCF engine: the character
sheet, skill rolls on the ladder, the four actions, aspects, fate points and free invocations,
stunts, stress and consequences, recovery, milestones, contests, extras, and NPCs and mobs.

## Install and load

```sh
pnpm add @opencharacter/fate-core @opencharacter/engine
```

This release needs spec 0.3: `@opencharacter/engine` 0.3.0 or later. An engine for an older
spec refuses it (`spec-version-unsupported`).

The package's default export is the pack's release, ready for `loadRuleset`; its English text is
`@opencharacter/fate-core/i18n/en` (also as JSON, `release.json` and `i18n/en.json`).

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import fateCore from '@opencharacter/fate-core';

const loaded = loadRuleset([fateCore]);
if (!loaded.ok) throw new Error(loaded.errors.map((e) => e.code).join(', '));
const { ruleset } = loaded;

// A random character, with the player's name and high concept.
const blank = {
  specVersion: '0.3.0',
  id: 'mara',
  packs: [{ id: 'fate-core', version: '0.2.0' }],
  creating: true,
};
const run = startAction(ruleset, blank, {
  action: { id: 'fate-core:random-character' },
  params: { name: 'Mara Vell', highConcept: 'Disgraced Duelist of the Seven Courts' },
});
if (!('status' in run) || run.status !== 'finished') throw new Error('creation paused');
const made = applyChanges(
  ruleset,
  blank,
  run.proposedChanges.map((p) => p.change),
);
if (!made.ok) throw new Error('creation failed');

const sheet = computeSheet(ruleset, made.character);
sheet.values['fate-core:refresh']?.value; // 3

// Overcome a Fair (+2) obstacle with Athletics: 4dF plus the skill, read on the ladder.
const roll = startAction(ruleset, made.character, {
  action: { id: 'fate-core:overcome' },
  params: { skill: 'fate-core:skills.athletics', opposition: 2 },
});
```

The [quick start](https://opencharacterformat.org/guides/quick-start/) and the
[guides](https://opencharacterformat.org/guides/) cover showing the sheet, rolling, pausing for
the player's choices and other characters.

## License

- **License:** CC-BY-3.0. Apps that show this pack's content must pass on its `credit`, which is
  the attribution the SRD asks for:

  > This work is based on Fate Core System and Fate Accelerated Edition (found at
  > https://www.faterpg.com/), products of Evil Hat Productions, LLC, developed, authored, and
  > edited by Leonard Balsera, Brian Engard, Jeremy Keller, Ryan Macklin, Mike Olson, Clark
  > Valentine, Amanda Valentine, Fred Hicks, and Rob Donoghue, and licensed for our use under
  > the Creative Commons Attribution 3.0 Unported license
  > (https://creativecommons.org/licenses/by/3.0/).

  [`LICENSE`](LICENSE) has it too, with the license's text.

- **Text:** names and short descriptions written for the pack (`i18n/en.yaml`), not the SRD's
  own prose, though its license would allow it. The pack uses no Fate logo; "Fate" is a
  trademark of Evil Hat Productions, LLC, and this pack is not affiliated with or endorsed by
  them.

## What's modeled

- **The ladder:** Legendary (+8) down to Terrible (−2), as the result bands `ladder`. A roll's
  result gets its rung's name (results past either end take the end's name), and so do the
  skills, the skill cap and the highest skill.
- **Skills:** the 18 default skills as numbers from Mediocre (+0) to Legendary (+8), tagged
  `skill` and with the actions the SRD lists for each (`skill.overcome`, `skill.advantage`,
  `skill.attack`, `skill.defend`). A setting pack adds a skill as a field tagged `skill`: it
  rolls, and the checks count it.
  - **Checks:** the pyramid (one Great, two Good, three Fair, four Average) while the character
    is being created; after that the column rule (no rung holds more skills than the one below);
    20 skill points plus those from milestones; and the skill cap (Great, raised by major
    milestones).
- **Aspects:** the high concept, the trouble and the three phase aspects, as the player's text.
  A finished character without a high concept has a rules issue (quick creation needs one to
  start play); a character being created doesn't.
- **Fate points and refresh:** refresh is 3 (raised by major milestones), less one per stunt past
  the three free ones and what extras cost; below 1 is a rules issue, and so is a starting
  refresh other than 3 at creation.
  - `accept-compel` gains a fate point and `spend-fate-point` spends one outside a roll (refusing
    a compel, declaring a story detail, invoking for someone else or against passive
    opposition).
  - `aspect-invoked` records a fate point paid to invoke one of the character's aspects against
    it, held in `fatePoints.pending` until the end of the scene.
- **Character creation:** a guided start, `create-character`, and a random one,
  `random-character`. Both take the name and aspects as optional parameters (`name`,
  `highConcept`, `trouble`, `phase1`, `phase2`, `phase3`), finish without them, and are kept out
  of play views.
  - **Guided:** the starting pyramid (the values 4, 3, 3, 2, 2, 2, 1, 1, 1, 1, each to a
    different skill), up to three free stunts and, if the player wants, one or two more at a
    point of refresh each; fate points equal to the refresh.
  - **Random:** the SRD has players choose, so the odds are the pack's. The pyramid's ten
    ratings go to ten skills drawn without replacement (every skill equally likely, a setting
    pack's included), and three stunts are drawn from the written stunts: the SRD's 17
    examples and any an add-on pack adds (never the custom one); no stunt is bought, so refresh
    and fate points are 3. Aspects not passed stay blank.
- **Rolling** (`skill-roll`, shared by every rolling action): 4dF plus the skill, or Mediocre
  without one, plus +1 per helper. After the dice the player may invoke aspects: up to three
  rerolls, each after seeing the last (a fate point or a free invocation each; one `rerolling`
  group step, its passes at `rerolling[<n>]/reroll`), then up to four +2s paid with fate points
  and four with free invocations. A free invocation held on the sheet is picked by its copy, and
  a copy with none left goes. Keeping the roll is recommended, so an automatic run spends
  nothing. A fourth reroll isn't offered: the SRD sets no limit, but each invocation needs a
  different aspect.
  - **What you need:** when the opposition is known before the dice (passive opposition, a
    defense against an attack's total, an `oppose` roll), the action passes it as `against` and
    `opposition`, and the dice (and each reroll) read on the band set `check` against it: Succeed
    with style, Succeed (the marked threshold, "Beat 2"), Tie, Fail. Against an `opponent` or a
    `target` who rolls after, the dice read on the ladder. Either way the result's `rung` is the
    dice total's ladder rung (the dice-less `rung` step), and the action's `final` step reads
    the total after invocations against the opposition.
- **Free invocations:** an `advantages.advantage` copy per aspect the character holds free
  invocations on (`label`, `invokes`, `kind`: situation aspect, boost or consequence inflicted).
  Created advantages, boosts from ties and style, and consequences an attack inflicts add them.
  A copy's `invoke` spends one outside the character's own roll, and `pass` gives one to a
  `recipient`. The end of a scene removes situation aspects and boosts.
- **The four actions** read the final total against the opposition: fail, tie, succeed (1–2
  shifts) and succeed with style (3+).
  - `overcome`: passive opposition, or an `opponent` whose app rolls `oppose`. Style gives a
    boost.
  - `create-advantage`: a new aspect or one in play (`existing`). Tie: a boost for a new aspect,
    a free invocation on an existing one; success one, style two. A failure on an existing aspect
    (or a failed new one created anyway) gives the free invocation to the `beneficiary`.
  - `attack`: the `target`'s app runs `defend`, then `take-hit` with the shifts, so the target
    picks its own stress and consequences; the attacker holds a free invocation on each
    consequence taken. A tie gives a boost, and style may trade a shift for one.
  - `defend`: against an attack's or advantage's total; a tie gives the attacker a boost, style
    gives one. Full defense is the situational choice `fullDefense` (+2).
- **Teamwork:** every rolling action takes `helper` participants; each helper's app runs
  `assist-check` on its own sheet, and each helper with the skill at Average (+1) or better adds
  +1. Without participants, `skill-roll`'s `helpers` parameter adds the same.
- **Contests:** `contest-exchange` rolls one exchange against `opponent` participants or an
  `opposition`. The best result scores a victory, two when it beats every other by 3 or more; a
  tie for the best is a twist. Three victories win; `end-contest` and the end of a scene clear
  them. **Challenges** are `overcome` rolls, one per task.
- **Conflicts:** turn order (`turnOrder.physical`: Notice, then Athletics, then Physique;
  `turnOrder.mental`: Empathy, Rapport, Will) as one hidden number each for the app to sort by; `move`
  (one zone free, more or past an obstacle with an Athletics overcome); `concede` (a fate point
  plus one per consequence taken in the conflict).
- **Stress:** physical and mental tracks of boxes worth 1 to 4 shifts: the 1 and 2 for everyone;
  Physique (physical) or Will (mental) at Average or Fair adds the 3, at Good or better the 4
  too.
- **Consequences:** a `consequences.consequence` copy each, with its slot (mild 2, moderate 4,
  severe 6, or the physical- or mental-only extra mild slot from Superb Physique or Will), its
  aspect text, the harm it came from and its recovery.
  - **Taking a hit** (`take-hit`): the player picks consequences (the reserved mild slot, mild,
    moderate, severe, then the extreme consequence, which absorbs 8 and replaces an aspect other
    than the high concept, once between major milestones), then one stress box worth at least
    what is left; with nothing left to hold it, the character is taken out. The recommendation
    takes a consequence only while the hit is bigger than the highest free box and the free
    slots can save the character, then the smallest box that holds the rest; never the extreme
    consequence.
  - **Recovery:** a consequence's `recover` is an overcome against Fair (mild), Great (moderate)
    or Fantastic (severe), two steps harder when treating yourself, or rolled by a `healer` on
    their own sheet. On a tie or better it is marked as recovering and may be renamed.
- **Time:** `end-conflict` clears stress and per-conflict stunt uses; `end-scene`, `end-session`
  and `end-scenario` (each runs the shorter one first) clear recovering consequences once a
  whole scene (mild), session (moderate) or scenario (severe) has passed, reset stunt uses, and
  bring fate points up to the refresh (a session) or reset them to it (a scenario).
- **Stunts:** a `stunt` content type with a `shape`: a +2 `bonus` (skill and action, applied
  when the situational choice `stunt` is on), a skill `swap`, a rules `exception`, or a `custom`
  stunt the player writes (its skill, action, limit, uses and fate point cost are the copy's own
  field values, `setField`). Stunts limited per conflict, scene or session, or costing a fate
  point, have a `use` action. The 17 SRD example stunts, plus `custom`:
  - bonus: Hardcore Parkour, Rumormonger, Lie Whisperer, Specialist (its field is the copy's
    label), Grappler, Indomitable;
  - swap: Mind Games, Take the Blow, Strength From Determination, I've Read about That! (a fate
    point);
  - exception: Riposte, Pedal to the Metal, Psychologist, Tough as Nails, Killing Stroke, Ninja
    Vanish, Trust Fund Baby.
  - **The exceptions' mechanics:** Riposte offers a 2-shift hit on the `attacker` when a Fight
    defense succeeds with style; Take the Blow takes 1 shift on a Physique defense's tie;
    Pedal to the Metal turns a Drive tie into a victory in a contest of speed; Psychologist
    (`treat`) rolls Empathy against Fair, Good or Great and lowers the `patient`'s consequence a
    step; Tough as Nails (`ease`) eases a physical consequence; Killing Stroke, offered after
    the target's `take-hit`, moves the least severe consequence up a slot; Ninja Vanish and
    Trust Fund Baby add their boost.
- **Extras:** an `extra` copy per power or piece of special gear: its permission (an aspect,
  `aspect` when it takes one of the character's aspect slots), its refresh per rank and its
  ranks. A stunt-like extra adds a bonus per rank to rolls with its skill and actions while the
  situational choice `extra` is on. The SRD's examples: Energy Blast, Super-Strength,
  Super-Speed, Super-Resilience, X-Ray Vision, Demonbane and a legendary dueling pistol, plus
  `custom`. An extra that is a new skill is a setting pack's field tagged `skill`; a vehicle,
  location or organization with skills and stress of its own is its own character.
- **Weapon and Armor ratings** (the SRD's optional rule, off until `ratings.weaponArmor` is on):
  the attack's Weapon rating (the `weapon` parameter, or an extra's) adds to a hit and makes a
  tie a hit of the rating; the Armor rating (worn, or an extra's) comes off a hit, and a hit it
  stops gives the attacker a boost. The highest rating counts; they don't add up.
- **NPCs and mobs:** `npc.kind` makes the sheet a `main`, `supporting` or `nameless` NPC.
  - NPCs are free of the skill-point budget and the cap; supporting and nameless NPCs of the
    columns too.
  - A supporting NPC has the usual stress tracks, a mild consequence (and the extra mild slots
    from Superb Physique or Will), and a moderate one with `npc.moderate`.
  - A nameless NPC is Average, Fair or Good by its best skill, with no, one or two stress boxes
    to match on one track for every hit, and no consequences.
  - A mob is a nameless NPC with `mob.size` members: +1 per member past the first, and a hit
    that takes out the front member carries on to the next.
  - Main NPCs take the extreme consequence as player characters do; other NPCs don't.
- **Milestones:** `minor-milestone`, `significant-milestone` and `major-milestone`, each giving
  the smaller ones' benefits. The player's words come in as parameters.
  - Minor: one of switching two skills' ranks (`skillA`, `skillB`; or an Average skill with an
    unrated one), changing a stunt, buying a stunt (while refresh stays at 1 or more), or
    renaming an aspect other than the high concept; moderate consequences begin recovery.
  - Significant: a skill point, spent at once (one rank each, up to the cap) or banked; severe
    consequences begin recovery.
  - Major: a point of refresh, the skill cap one higher, the extreme consequence put behind (its
    aspect renamed, `recovered`), and a new high concept if given.
- **Sheet layout:** display groups for the actions (rolls, fate points, the copies' own actions,
  conflicts and contests, milestones, time, creation) and the content (stunts, consequences,
  aspects with free invocations by kind, extras).

## Add-on packs

A pack that depends on `fate-core` (a setting pack) adds to it without changing it:

- **Skills** are fields tagged `skill` (with `skill.overcome`, `skill.advantage`, `skill.attack`,
  `skill.defend` for the actions they take): the pyramid, the skill cap, milestones and every
  roll take an added skill as the core's.
- **Stunts and extras** are content of the `stunt` and `extra` types: creation, milestones and
  the random start (every written stunt but the custom one) offer an added stunt.
- **Tagged steps**, for an add-on's rules-level `option` effects: `creation.stunts` (the
  standard start's stunt picks and the random start's draws), `milestone.benefit` (a minor
  milestone's benefit, which every milestone runs) and `milestone.stunt` (its new stunt); for
  its `changes` effects: `creation.finish` (the last step of both starts), and `time.conflict`,
  `time.scene` and `time.session` (the ends of a conflict, scene and session; a longer one runs
  the shorter ones' too).
- **Open enum:** a stunt's `limit` (`fate-core:types.stunt.fields.limit`), a written stunt's
  or a custom stunt's own (`setField`). The core's `use` counts an added limit's uses as its
  own; the core's ends of a conflict, scene and session reset only theirs, so the add-on resets
  its limit from a tagged step (a `changes` effect on `time.scene` with a `setState` of `used`
  over the stunts with it).
- **Still closed:** a stunt's `shape` and `action`, a consequence's slot, harm's physical and
  mental, and the NPC kinds are the SRD's fixed sets that the core's rules read; a setting with
  another stress track or action is a variant, not an add-on.
- **Naming what an add-on adds:** added skills, stunts and extras are the add-on's own fields
  and content, named in its own text (`fields.skills.hacking.name: Hacking`). An added limit
  `day` is named under this pack's key in the add-on's text,
  `types.stunt.fields.limit.values.day.name: Once per day`, which `createText` finds when the
  app passes the ruleset's `enumOrigins`.

## Text only, and left to the app

- **Text only:** aspects, situation aspects and what a boost says are the player's words; which
  aspect each invocation is on, and that each is invoked once per roll; a swap stunt's skill
  substitution (the rolls take any skill); Demonbane's and X-Ray Vision's narrative powers; a
  custom extra's Weapon or Armor rating (the attack's `weapon` and worn armor carry it).
- **Left to the app and the table:** opposition and difficulties; who takes part (targets,
  opponents, helpers, the patient, who benefits from a failed advantage); when conflicts, scenes,
  sessions and scenarios end; zones and whose turn it is; the order of rolls in an exchange (to
  invoke after seeing the defense, the app runs the defender's `defend` first and passes its
  total as `opposition`); and a Killing Stroke on a severe consequence (`strokeSecond`), whose
  second consequence the SRD leaves open.

## Out of scope

- The GM's tools (game creation, issues, scenarios), and character death beyond being taken out.
- **Fate Accelerated, Fate Condensed and the Fate System Toolkit:** each would be its own pack.

## Sources

The Fate Core System SRD at fate-srd.com (Characters, Aspects and Fate Points, Skills and Stunts,
Actions and Outcomes, Challenges, Contests and Conflicts, The Long Game, Extras), checked against
the SRD's Markdown text (github.com/fate-srd/fate-srd-content).

## Rule readings

Where the SRD leaves a rule open, the pack reads it this way:

- **Random start:** the SRD has players choose, so the odds are the pack's: every skill and
  every example stunt equally likely, no stunt bought past the free three.
- **Rerolls:** at most three per roll. The SRD sets no limit, but each invocation needs a
  different aspect.
- **Fate points from aspects invoked against you** arrive at the end of the scene; a
  concession's fate points are immediate.
- **Ties:** a tie on a recovery roll starts recovery (an overcome tie reaches the goal at a minor
  cost), and so does a tie on Psychologist's roll.
- **Stress:** any box worth at least the remaining shifts may be checked (the smallest is
  recommended). The end of a session or scenario counts as the end of a scene too, so stress
  clears.
- **Weapon and Armor ratings:** the best weapon and the best armor count, and a weapon adds after
  a shift traded for a boost.
- **Stunts:** Killing Stroke raises the least severe consequence a hit filled, and only into a
  free slot; Riposte's hit is physical; Super-Speed's +2 in contests of pure speed is to
  Athletics.
- **Supporting NPCs** aren't held to the skill columns: the SRD's own examples break them.
