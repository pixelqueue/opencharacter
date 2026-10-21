# Mothership 1e

`@opencharacter/mothership-1e` is an **unofficial, mechanics-only**
[Open Character Format](https://opencharacterformat.org/) pack for the Mothership RPG, 1st
edition, by Tuesday Knight Games. It is for apps that build, show and play Mothership characters
with an OCF engine: stats and saves, the four classes, the 42 skills, checks and saves, stress
and panic, health, wounds and death, shore leave, and the shapes of weapons and armor.

It is not affiliated with or endorsed by Tuesday Knight Games, and carries no rules text, flavor
text, art, logo or item lists from the game: only mechanics, and names and short labels written
for this pack.

## Install and load

```sh
pnpm add @opencharacter/mothership-1e @opencharacter/engine
```

The package's default export is the pack's release, ready for `loadRuleset`; its English text is
`@opencharacter/mothership-1e/i18n/en` (also as JSON, `release.json` and `i18n/en.json`).

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import mothership from '@opencharacter/mothership-1e';

const loaded = loadRuleset([mothership]);
if (!loaded.ok) throw new Error(loaded.errors.map((e) => e.code).join(', '));
const { ruleset } = loaded;

// A random character: stats, saves, a class, health, skills and credits, all rolled.
const blank = {
  specVersion: '0.1.0',
  id: 'okafor',
  packs: [{ id: 'mothership-1e', version: '0.1.0' }],
  creating: true,
};
const run = startAction(ruleset, blank, { action: { id: 'mothership-1e:roll-character' } });
if (!('status' in run) || run.status !== 'finished') throw new Error('creation paused');
const made = applyChanges(
  ruleset,
  blank,
  run.proposedChanges.map((p) => p.change),
);
if (!made.ok) throw new Error('creation failed');

const sheet = computeSheet(ruleset, made.character);
sheet.values['mothership-1e:stress.current']?.value; // 2

// A Combat check: a d100 read 00–99, under Combat to succeed. A failure proposes 1 stress.
const check = startAction(ruleset, made.character, {
  action: { id: 'mothership-1e:stat-check' },
  params: { stat: 'mothership-1e:stats.combat' },
});
```

The guided start, `guided` (the action with `params: { choose: true }`), lets the player pick
the class and skills. The [quick start](https://opencharacterformat.org/guides/quick-start/) and
the [guides](https://opencharacterformat.org/guides/) cover showing the sheet, rolling, pausing
for the player's choices and other characters.

## License

- **License:** `mechanics-only`. The pack carries only mechanics and labels, so no license asks
  for a credit. [`LICENSE`](LICENSE) gives its terms: the contributors' own work in it (its
  data, and the names and short labels written for it) is under CC0 1.0. The game, its names
  and its trademarks belong to Tuesday Knight Games.
- **Notice:** `pack.yaml` carries one notice, `not-affiliated`, for apps to show beside the
  pack's content:

  > Mothership is a game by Tuesday Knight Games. This pack is an unofficial model of its
  > mechanics: it is not affiliated with or endorsed by Tuesday Knight Games, it is not
  > published under Tuesday Knight Games' third-party license, and it carries no rules text,
  > flavor text, art or logo from the game.

- **Why no text:** Mothership's third-party license is a per-product publishing agreement that
  doesn't clearly cover software or data, so the game's text could only be added through that
  route (3pp@tuesdayknightgames.com).

## What's modeled

- **Stats and saves:** Strength, Speed, Intellect, Combat; Sanity, Fear, Body.
- **Character creation:** two starts, both running `roll-character` on a character being
  created that has no class yet, in the Player's Survival Guide's order: stats and saves, the
  class, health, the class's stat change, skills, then the loadout or credits.
  - `roll` (random): a d4 recommends the class (in the ruleset's content order) and, for the
    Android and the Scientist, the stat the class lowers or raises; every pick is recommended,
    so an automatic run finishes the character.
  - `guided`: no die is rolled for those; the player picks, the first option recommended.
  - Each stat is 2d10+25, each save 2d10+10, maximum health 1d10+10, credits 2d10×10 with a
    class loadout (recommended; the app adds the loadout) or 2d10×100 without one (the `kit`
    choice; the outcome's `loadout` says which).
  - Then the class's skill picks, one at a time with their eligible options, so an Expert or
    Master skill is asked once its prerequisite is picked. There's no `#done` while the
    character is being created, so every pick is made before the run finishes it.
  - A character being created needs a class (`creation-class`), on a sheet filled in by hand
    too, and never has more than one, so an app offers Replace once a class is held.
- **Classes:** Marine, Android, Scientist and Teamster.
  - Their stat, save and maximum-wound adjustments apply on top of the rolled values.
  - Each grants its fixed skills and offers its skill picks: Marine and Android one Expert or
    two Trained; Scientist a Master skill with an Expert and a Trained skill on the way to it,
    and one more Trained; Teamster a Trained and an Expert. No pick offers a skill the
    character already has.
  - The Android's −10 and the Scientist's +5 to a stat are choices too.
  - **Trauma responses** reach close friendly players, the `close` participants the app
    passes (who is close is the app's):
    - Marine: when it panics (a `panic-check`, or one a check or save runs), each close player's
      app runs a Fear `save` (a handoff).
    - Android: a close player's Fear save is at [-] with the situational choice `android` (Fear
      saves tag their roll `save.fear`).
    - Scientist: a failed Sanity save (`save` or `skill-check`) gives each close player 1 stress.
    - Teamster: the situational choice `teamster` gives a panic check [+], offered once until
      `end-session` (the app's clock) clears `trauma.used`.
- **Skills:** all 42, each Trained (+10), Expert (+15) or Master (+20).
  - An Expert or Master skill needs any one of its prerequisites; a missing one is a rules
    issue.
  - `skill-check`, run from a skill, adds its bonus to a stat or save. Only one skill applies
    to a roll.
- **Checks:** `stat-check`, `save` and `skill-check` roll under the target on a d100 read 00–99
  (`1d100z`).
  - 90–99 always fails. Doubles are criticals; 00 is always a critical success (even against
    a 0), and 99 always a critical failure.
  - Any failure gains 1 stress, and a critical failure also runs a panic check.
  - Advantage [+] and disadvantage [-] are situational choices (also for panic checks and wound
    rolls); together they cancel.
- **Stress and panic:** stress starts at 2, can't go below its minimum (`stress.minimum`, start 2) and is capped at 20.
  - `panic-check`: a d20 over current stress passes; the roll is returned for the panic table.
  - `rest`: a save against the lowest save. Success removes stress equal to the roll's ones
    digit; failure adds 1.
  - **Stress past 20** comes off the most relevant stat or save: the `excess-stress` follow-up
    gives the amount the cap clamped away, and its action asks which stat or save (a ruling).
  - **Shore leave** (`shore-leave`, once the app has taken the port's cost): a Sanity `save`.
    - Success converts stress into save points up to the port's conversion die (`convert`;
      `all` for a port that converts everything), split by the player, then relieves the rest
      down to the minimum. Converting stops at the minimum stress, which the source leaves open.
    - An X-class port's [+] (situational `xClass`) rolls the whole conversion roll twice and keeps the better total.
    - A critical success converts the die's most; a failure relieves everything down to the
      minimum and adds 1; a critical failure converts and relieves nothing and makes a panic
      check (the save's own).
- **Health and wounds:** health reaching 0 adds a wound and resets health to its maximum, less
  the damage carried past 0, in the same change; a carry that reaches 0 again is another wound
  (at maximum wounds the death save decides).
  - `take-damage` and `heal`, on the health tile and in the harm group, apply damage and
    healing by hand: `take-damage` (`amount`, `wounds`, `antiArmor`) adjusts health and wounds
    tagged `damage` (or `damage.anti-armor`), so worn armor applies as for an attack; `heal`
    (`amount`) gives health back, up to the maximum. Wounds dealt directly bypass armor.
  - `natural-healing` (once a day after 6+ hours of rest, the app's clock): a Body save;
    success resets health to its maximum, and wounds stay.
  - `death-save` and `wound-roll` (by damage type) roll the d10 (0–9) and return it for the
    tables.
  - Follow-ups: a wound stores `wound-roll` (the app supplies the damage type), one per
    adjustment, and reaching maximum wounds stores `death-save`. They and the excess stress
    are all required follow-ups stored on the character until acted on or
    dismissed (the death save also until wounds drop below maximum); the app runs them. They
    trigger on the fields, so a plain edit of health fires them too.
  - Bleeding, credits and high score are tracked as values. `bleed`, which the app runs each
    round, takes 1 health per point of bleeding, ignoring armor and damage reduction.
- **Weapons (shape only):**
  - Fields: damage dice and/or a number of Wounds, an optional magazine, range, wound type,
    anti-armor.
  - Per-copy `shots` start full.
  - `shoot` (weapons with a magazine): spend a shot, then attack.
  - `attack` (weapons without one): a Combat check, then damage on a hit.
- **Armor (shape only):** AP, DR, bulky, and a per-copy `destroyed` flag. Worn bulky armor puts
  Speed checks at [-] (their rolls are tagged `check.speed`). On worn armor:
  - damage reduction (DR) comes first, and always: on destroyed armor too, and against
    anti-armor weapons; it never turns damage into healing;
  - intact armor then ignores the damage left under its armor points (AP);
  - damage at or over AP breaks the armor (`destroyed`), and the rest gets through;
  - anti-armor damage (tagged `damage.anti-armor`) ignores AP and destroys the armor.
- **Sheet layout:** display groups for actions (attacks, checks, save rolls, stress and panic,
  health, wounds and death, character creation, kept out of play views) and content (class,
  skills by Trained, Expert and Master, weapons, armor), and for credits and high score. A
  weapon shows its damage as dice and its shots as a track (only with a magazine); armor shows
  `destroyed` only when destroyed.

## Text only, or the app's

- **No items.** Weapon and armor lists, loadouts, trinkets and patches stay out of this pack.
  The item shapes are here, so apps and homebrew can add items.
- **Tables.** The panic, wound and death save tables are text. The actions return the roll for
  the app to look up. The shore leave port table (each port class's cost and conversion die) is
  a table too: the app passes the die.
- **Conditions.** They come only from the panic and wound tables' results (text), and last
  until medical care, which is the Warden's. So do the panic results that raise minimum stress
  or add stress.
- **Contractors.** Hirelings the Warden runs, with a sheet of their own (Combat, Instinct,
  Loyalty, maximum wounds, no health). Their numbers come from the Warden's contractor tables.
- **Decided at the table or by the app:** who is close, for the trauma responses; when a round,
  a day or a session ends (`bleed`, `natural-healing`, `end-session`); which stat or save
  stress past 20 lowers (`excess-stress` asks).

## Sources

The mechanics were checked against the Player's Survival Guide v1.1 (facts only, as quoted by
public copies) and its skill tree.

## Rule readings

Where the guide is unclear or silent, the pack reads it this way:

- **Random start:** a d4 recommends the class, and for the Android and the Scientist the stat
  they change: every option equally likely.
- **Class skill picks** never offer a skill the character already has. The Scientist's Expert
  and first Trained picks are limited to those on the way to some Master skill, so a guided run
  can't reach a dead end.
- **Armor order:** damage reduction first, and always (on destroyed armor and against
  anti-armor weapons too); armor points are compared with the damage left after it; anti-armor
  damage ignores armor points and destroys the armor.
- **00** is always a critical success, even against a stat or save of 0.
- **[+] on a multi-die roll** (an X-class port's conversion roll) rolls the whole roll twice and
  keeps the better total.
- **A wound at 0 health:** its character steps say a wound comes when health falls below zero,
  its damage section when health reaches zero. This pack takes zero.
- **Critical hit damage:** not modeled; community sources disagree (damage rolled with
  advantage, or doubled).
- **Shore leave:** whether converting stress can go below the minimum is left open; this pack
  stops at the minimum.
- **Heavy armor:** the guide's heavy suits (Vaccsuit, Advanced Battle Dress) put Speed checks at
  [-], which is this pack's `bulky`.
