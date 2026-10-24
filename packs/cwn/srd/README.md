# Cities Without Number (SRD)

`@opencharacter/cwn-srd` is an [Open Character Format](https://opencharacterformat.org/) pack
of the character rules of the Cities Without Number System Reference Document 1.0, which its
author, Kevin Crawford, dedicated to the public domain under CC0. It is for apps that build, show
and play its characters with an OCF engine: attributes and skills, backgrounds, Edges and Foci,
hit points, saves and combat, advancement to 10th level, System Strain and cyberware, weapons,
armor and gear, hacking, drones and vehicles, Contacts, and the optional magic and alienation
rules. It carries the document's own text and tables.

Compatible with Cities Without Number, by Kevin Crawford. This pack is unofficial: it is not
affiliated with, approved or endorsed by Kevin Crawford or Sine Nomine Publishing.

## Install and load

```sh
pnpm add @opencharacter/cwn-srd @opencharacter/engine
```

The package's default export is the pack's release, ready for `loadRuleset`; its English text is
`@opencharacter/cwn-srd/i18n/en` (also as JSON, `release.json` and `i18n/en.json`).

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import cyber from '@opencharacter/cwn-srd';

const loaded = loadRuleset([cyber]);
if (!loaded.ok) throw new Error(loaded.errors.map((e) => e.code).join(', '));
const { ruleset } = loaded;

// A random character: attributes rolled in order, the background's skills rolled, every other
// pick drawn.
const blank = {
  specVersion: '0.2.0',
  id: 'new-operator',
  packs: [{ id: 'cwn-srd', version: '0.1.0' }],
  creating: true,
};
const run = startAction(ruleset, blank, {
  action: { id: 'cwn-srd:create-character' },
  params: { random: true },
});
if (!('status' in run) || run.status !== 'finished') throw new Error('creation paused');
const made = applyChanges(
  ruleset,
  blank,
  run.proposedChanges.map((p) => p.change),
);
if (!made.ok) throw new Error('creation failed');

const sheet = computeSheet(ruleset, made.character);
sheet.values['cwn-srd:saves.physical']?.value; // 15 less the better of Str and Con
```

The guided start, `guided` (the same action without `random`), pauses for every pick, each with
a recommendation, so an automatic run finishes too. Campaigns with magic or alienation turn on
the input fields `campaign.magic` and `campaign.alienation`. The
[quick start](https://opencharacterformat.org/guides/quick-start/) and the
[guides](https://opencharacterformat.org/guides/) cover showing the sheet, rolling, pausing for
the player's choices and other characters.

## License

- **License:** `CC0-1.0`. The source document is CC0, and so is this pack: [`LICENSE`](LICENSE).
- **Notice:** `not-affiliated`, which apps show as they would a license notice. CC0 asks for
  nothing; the document's author asks that works built on it not be presented as official or
  endorsed.

## What it models

- **Attributes:** the six scores (3d6 in order with one score made 14, or the array), their
  modifiers (Prodigy's +3, bonuses capped at +2, or +3 where the source says so), and cyberware
  that sets a score.
- **Skills:** 19 skills, plus Cast and Summon for magic, from no skill (-1) to level-4; checks
  are 2d6 plus skill and attribute, with Specialist's and Healer's extra dice. Skill levels are
  saved inputs: creation and advancement raise them, and skillplugs lift the level checks use.
- **Creation:** a guided and a random start. Backgrounds with their free skill and Growth and
  Learning tables (three rolls split between them, or two Learning picks), the rule that a
  third pick of a skill becomes another skill, attribute bonuses split among physical or mental
  attributes, two Edges, a Focus, the Underdog Rule's bonus Edge, hit points, the free skill,
  two Acquaintances or a Friend, $500 and an item of up to $1,000. Edges and Foci bring their
  bonus skills, gear budgets, starting cyber, programs, spells and arts.
- **Edges** (14, and the three magical ones) in rules-level choices: two at creation, the
  Underdog Rule's, and a third at 5th level. `gain-edge` finishes `closed` for the 5th-level
  Edge below 5th level and for the Underdog Edge without the rule. The Underdog Rule counts the
  modifiers of the rolled scores (`attributes.modTotal`), so its bonus Edge can't undo it. **Foci** (26) are copies with a level, gained at
  creation, at 2nd, 5th, 7th and 10th level and with Focused; a Focus's bonus skill during
  advancement is three skill points toward it, banked as credit.
- **Advancement:** experience on the fast or slow table, a level-up action (hit points rerolled
  per level, skill points, the Focus and Edge the level brings), and actions to spend skill
  points on skills and attribute boosts.
- **Combat:** attack bonus, saves, initiative, Ranged and Melee AC, Trauma Target, Damage Soak
  that ablates per fight, and an attack action with the attribute choice, skill (-2 untrained),
  burst fire, Shock on a miss, the Trauma Die and Traumatic Hits, Killing Blow, Armsmaster and
  Deadeye. Weapons track their magazines.
- **Gear:** every weapon, armor, accessory, mod, mission gear, pharmaceutical, cyberdeck,
  program element, drone, drone fitting, vehicle, vehicle fitting and mod in the document.
  Mods, fittings and armor accessories are templates on their item; fittings use a drone's
  fittings or a vehicle's Power and Mass. Encumbrance counts Readied and Stowed gear.
- **Cyberware:** all 80 systems with their System Strain (eye and ear mods halved by
  cybereyes and cyberears), effects, cyberware mods and implant complications as templates,
  skillplugs, and the optional alienation rules with the chrome syndromes. System Strain
  counts implants, lifestyle and the drugs, first aid and cyber that add to it.
- **Hacking:** Access, Memory, CPU and Shielding from the best deck, the program elements in
  Memory, the programs a hacker can write and keep, and an action to run a program.
- **Magic:** Mage and Summoner Effort, cyber's cost to them, prepared spells, casting and
  overcasting, summoning (each spirit's cost from its own powers and ritual), spirits and their
  powers, and Graced arts with their points. Martial Instinct's bonus rolls (the `bonusRoll`
  situational choice on an attack) roll the hit or damage twice, the better kept, and refresh
  with rest; Occult Pavis rolls saves against magic (`versusMagic`) twice.
- **Contacts**, named by the player, as Acquaintances or Friends.

## Add-on packs

A pack that depends on `cwn-srd` can add content of its types, and creation and advancement offer
it with the core's: backgrounds, Edges and Foci in the guided picks and the random draws, and
weapons, armor, gear, cyberdecks and drones as the free starting item. What content brings is read
from its fields and tags, not its ID: a Focus or Edge's `startingItems` and `startingCyber` (write
another pack's items by qualified ID, `<pack>:gear.<id>`), `brings-cyber` for one that brings
cyberware, `bars-cyber` for one that bars it (as All Natural does), `repeatable`, `not-underdog`.

- **Open enums:** cyberware `category`, a program Subject's `subjectType` (a Verb's `targets`
  name them), a drone's `moveKind` and a spell's `duration`. An add-on lists new values in
  `extendEnums` and names them in its text.
- **Tagged steps** take an add-on's rules-level `option` and `changes` effects: `creation.item`
  (the free starting item's kind: an added option is another free item), `creation.gear` (the
  starting money and lifestyle), `creation.finish` (the last step of creation),
  `advancement.level` (each new level), `rest.night` (a night's rest) and `rest.scene` (the end of
  a scene).

Still closed: skills (the core's changes name a skill's fields by key, which resolve in this pack
only), and the enums that are the rules' own: a program's `kind` (Verb or Subject), armor `kind`,
cyberware `concealment`, a spell's `effort`, vehicle `size`, and the attributes.

## Left to the table

- Situational modifiers (cover, range, prone targets, snap attacks, charges, dual wielding) are
  the attack's and checks' `modifier` parameters.
- Execution Attacks, suppressive fire, grappling, drone and vehicle combat, chases, demons and
  network architecture are text: the attack covers single and burst fire.
- Once-per-scene and once-per-day abilities (rerolls, Veteran's Luck, Enhanced Reflexes) are
  text; the cyber that costs System Strain to trigger has a trigger action.
- Starting languages are a count and a free text field: the city's languages are the setting's.

## Rule readings

- **Random start:** the attributes are rolled in order (one score made 14: the lowest, if under
  14), and the background's skills rolled, each roll's table drawn. Everything else is drawn
  among the eligible options.
- **Guided recommendations:** the first eligible option, so an automatic run finishes; the
  recommended Focus gear is the dearest vehicle or drone the budget buys, then the dearest that
  still fits, until the budget is spent.
- **Physical skills** for skillplugs: Drive, Exert, Perform, Punch, Shoot, Sneak and Stab.
- **Pushing encumbrance:** up to two Readied and four Stowed past the limits is Move 7 m, twice
  that is Move 5 m, and more is past the limits.
- **Dermal plating and armor** don't stack: the higher base AC applies.
