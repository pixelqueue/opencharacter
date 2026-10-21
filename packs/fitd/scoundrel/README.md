# Forged in the Dark scoundrel (mechanics only)

`@opencharacter/fitd-scoundrel` is an **unofficial, mechanics-only** model of a Forged in
the Dark scoundrel for the [Open Character Format](https://opencharacterformat.org), holding only
what the game's System Reference Document (SRD) contains: the ratings, rolls, stress,
harm, downtime and the SRD's pool of special abilities, as data an OCF engine runs. It is for app
developers who want Forged in the Dark scoundrels in a character app. The crew is a separate pack,
[`@opencharacter/fitd-crew`](https://github.com/pixelqueue/opencharacter/tree/main/packs/fitd/crew).

It is not affiliated with or endorsed by One Seven Design or John Harper. It carries no rules
text, flavor text, art, logo or setting from the game: the text in `i18n/en.yaml` is names and
short descriptions written for the pack.

## Install and load

```sh
pnpm add @opencharacter/engine @opencharacter/fitd-scoundrel
```

```ts
import { applyChanges, computeSheet, loadRuleset, startAction } from '@opencharacter/engine';
import blades from '@opencharacter/fitd-scoundrel'; // the pack release
import en from '@opencharacter/fitd-scoundrel/i18n/en'; // its English text

const loaded = loadRuleset([blades]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { ruleset } = loaded;

// A new scoundrel: the random start draws every pick.
const blank = {
  specVersion: '0.1.0',
  id: 'new-scoundrel',
  packs: [{ id: 'fitd-scoundrel', version: '0.1.0' }],
  creating: true,
};
const created = startAction(ruleset, blank, {
  action: { id: 'fitd-scoundrel:create-scoundrel' },
  params: { random: true },
});
if ('status' in created && created.status === 'finished') {
  const applied = applyChanges(
    ruleset,
    blank,
    created.proposedChanges.map((p) => p.change),
  );
  if (applied.ok) console.log(computeSheet(ruleset, applied.character).values);
}
```

The guided start (`creation` start `scoundrel`) pauses for each pick. With a crew sheet, link it
through the `fitd-scoundrel:crew` slot and pass its computed values as the link's view
(see the crew pack). The guides on
[packs and rulesets](https://opencharacterformat.org/guides/packs-and-rulesets/) and
[building characters](https://opencharacterformat.org/guides/building-characters/) cover the
calls.

## What the SRD contains, and so the pack

The source is the game's SRD (CC-BY 3.0, <https://bladesinthedark.com>; source text
at <https://github.com/amazingrando/blades-in-the-dark-srd-content>). It has the core system,
character creation as a set of steps, a pool of 42 special abilities, the 7 vices and 8 trauma
conditions, downtime, rituals and crafting, and the crew rules. It has **no named playbooks**
(only a playbook template: three starting dots, a list of abilities, xp triggers), **no item
lists** and no spirit playbooks, so the pack has none of those either. A table's own playbooks
and items are homebrew (below).

## Making a scoundrel

There is no playbook by default. `create-scoundrel` (the guided start `scoundrel`, or the random
start `random`):

1. picks one special ability from the SRD's pool (the rules-level choice `special-abilities`,
   one plus one per playbook advance) and a vice;
2. places the playbook template's three starting dots (at most 2 in one action);
3. adds four dots, one for the heritage, one for the background and two anywhere, none taking an
   action above 2, so a new scoundrel has seven;
4. asks what is still pending (Expertise's action) and writes the player's words (heritage,
   background, alias, look, close friend, rival, vice purveyor) when given.

A sheet filled in by hand is checked by `creation-dots` (seven dots) and `creation-rating-limit`
(none above 2) while it is being created. The SRD creates scoundrels by choice, so the random
start's odds are the pack's: every pick uniform over what the guided start offers, the dots one
at a time to an action that can still take one.

**A table's own playbook** is a homebrew item of the `playbook` type: its `twoDots` and `oneDot`
fields place its starting dots, and its own `special-ability`
choice offers its abilities (by ID or by a tag homebrew abilities carry). With one, creation
picks it first, places its dots for the player, and asks its ability with the pending picks.
[An example](https://github.com/pixelqueue/opencharacter/blob/main/examples/characters/fitd-ash.yaml)
defines one.

## What's modeled

### Ratings, rolls and position

- The 12 action ratings (input dots, 0 to 4) and the three attributes (Insight, Prowess,
  Resolve), each counting its actions with at least one dot, read by tag (`rating.<attribute>`),
  so a homebrew rating counts too.
- **Action roll:** a pool of d6s equal to the rating, keep the highest; with no dice, roll 2d6
  and keep the lowest. Critical (two or more 6s), success (6), partial (4–5), failure (1–3).
  The roll carries the rating's tags (`rating.resolve.command`).
- **Situational choices:** push yourself or take a devil's bargain (one of them, +1d), assist
  (+1d), push yourself for +1 effect, and position and effect. Each push costs 2 stress. The
  outcome carries the position and the final effect (zero to great).
- **Assist:** an assisting character passed as the `helper` adds the die and takes the 1 stress.
  **Group action:** the leader rolls and each `member`'s roll is handed off; the best result
  counts for all, and the leader takes 1 stress per failure (at most 1 with Expertise).
- A desperate action roll proposes 1 xp in the rated action's attribute.
- **Resistance roll:** the attribute's dice; costs 6 minus the highest die in stress, and a
  critical clears 1 stress. **Fortune roll:** a pool of any size, read like an action roll.

### Stress, trauma, harm and healing

- Stress (9 boxes) and trauma (4). Marking the last stress box adds a trauma and clears stress.
  Four trauma is the rules issue `retire`. One trauma condition per trauma.
- **Harm is content:** one `harm.harm` copy per harm, with its `level` (1 to 3) and the player's
  `label`. Two slots at levels 1 and 2, one at level 3: less effect, −1d, need help. `take-harm`
  marks harm, moving it up while its level is full; level 4 is `fatal`. New harm clears the
  healing clock.
- **Healing:** a 4-segment clock ticked by `heal`. Each fill removes level 1 harm and moves the
  rest down a level; excess ticks start a new clock. **Recover:** the healer's rating or quality
  ticks it (critical 5, success 3, partial 2, failure 1); treating yourself costs 2 stress;
  toughing it out rolls 0d for 1 stress.
- Armor: the standard, heavy and special armor boxes. The special box shows while an ability
  gives it.

### Downtime

- **Indulge vice** (lowest attribute, clear that much stress; overindulging asks for the bad
  call: attract trouble, brag for +2 heat to the linked crew, lost, tapped). **Ignore your
  vice:** stress equal to trauma.
- **Train** (1 xp, 2 with the crew's Training upgrade), **long-term projects** (4-, 6-, 8- or
  12-segment clocks ticked by an action roll), **reduce heat** (5, 3, 2 or 1 off the linked
  crew), **acquire an asset** (a roll of the crew's tier for its quality, +1d for the same asset
  again, +2 heat for a restricted item), **recover**. Each coin after the roll raises the result a
  level; a friend or contact who helps adds a die.
- Coin (4) and stash (40): stash one for one, withdraw at 2 stash per coin; lifestyle is one
  level per full 10 stash. **Flashbacks:** 0, 1 or more stress, or 1 coin for a downtime
  activity.
- **Rituals** (learn as an 8-segment project; the Ritual ability starts with one; perform for the
  stress the GM sets, with an action roll if dangerous and a fortune roll if uncertain; prime and
  unleash) and **crafting** (invent a design as an 8-segment project; Alchemist, Artificer and
  Strange Methods start with one; craft with Tinker for quality from the crew's tier, +1 with a
  Workshop, +1 per coin; modify an item for tier +1, +2 or +3; use a creation, spending a use or
  rolling its quality).

### Special abilities

The SRD's 42, as one pool. With mechanics: special armor that pays for a push (Battleborn,
Focused, Fortitude, Shadow, Subterfuge, Mastermind, Warded); extra dice or effect in their
situations (Bodyguard, Savage, Scout, Ambush, Daredevil, Trust in Me, Weaving the Web, Arcane
Mind, Iron Will, Vigorous); result levels for crafting and downtime (Alchemist, Artificer,
Strange Methods, Connected); Mule, Vigorous and Tough as Nails; Rook's Gambit (an action: the
best rating for 2 stress); Expertise; Analyst's two ticks; A Little Something on the Side;
Foresight; Devil's Footsteps, Not to Be Trifled With and Sharpshooter (a push for their benefit,
which brings its die or effect); the Ritual ability. The rest are text only (the fiction's, or a
factor the GM weighs): Arcane Fighter, Leader (read by the crew pack's
cohort roll), Vengeful, Supernatural Ward, Saboteur, Infiltrator, Reflexes, Like Looking into a
Mirror, Mesmerism, Calculating.

### Items

The SRD lists no items, so the pack has none. The `gear` type is there for a table's own
(homebrew) items: each with its load and kind; `equipped` is what is carried on this score, and
the load carried must fit the chosen load level (constraint `load-limit`). Each copy shows its
quality: the linked crew's tier, +1 for a fine item, +1 for the crew's Quality upgrade of the
item's kind. Items tagged `standard` are held by every scoundrel.

### With a crew sheet

The crew is its own character file with `@opencharacter/fitd-crew`, linked through
the `crew` slot. Its tier and Workshop feed acquiring an asset and crafting, its Mastery the
rating cap (3, or 4), its tier and Quality upgrades item quality, and its Training upgrades
training. Heat goes to the crew. What the crew gives its members is read from its `members.*`
fields and its Rigging: an extra stress or trauma box, the dot abilities (the choice `crew-dots`,
each dot up to 3), bonus dice (resistance, asset rolls, recovery, gathering information, about
the elite, passing as ordinary citizens, against the supernatural, at a claim's site),
Synchronized group actions, the prison loadout and the Rigging's free load (two load of the two
kinds of item it names). Without a crew sheet those actions take `tier` and `workshop`
parameters and the player sets `crew.mastery`.

### Sheet layout

Display groups for actions (action rolls, resistance, on the score, harm and healing, downtime,
creation) and content (playbook, abilities, harm worst first, trauma, items, vice, creations,
projects, rituals, designs).

## Out of scope

- Playbooks, items and the spirit playbooks: not in the SRD (a table's own are homebrew).
- Who takes a consequence when a teammate protects another: the GM's ruling, so the app runs
  `take-harm` on the protector.
- Counting downtime activities, restoring armor at the next load, coin carried as load, pushing
  to act while incapacitated: the app's or the player's.

## Rule readings

- **SRD only:** the pack holds only what the SRD contains, so it has no named playbooks, no item
  lists, no spirit playbooks, and only the SRD's 42 special abilities. A table's own playbooks
  and items are homebrew.
- **No playbook:** the scoundrel places the playbook template's three starting dots itself, so a
  new scoundrel still has seven.
- **Random start:** the SRD creates scoundrels by choice, so the odds are the pack's: every pick
  uniform over what the guided start offers, the dots placed one at a time.
- **Pushing for an ability's benefit** still brings a die or effect, so it is one push, not two.
  Special armor pays for one push; pushing for both a die and effect is two.
- **Armor:** the SRD lists no armor items, so the standard and heavy boxes are always on the
  sheet.
- **Text-only abilities:** where an ability's benefit is a factor the GM weighs when setting
  effect (Arcane Fighter, Infiltrator), it is the action roll's `effect` choice, not a fixed
  bonus.

## Limitations

- A situational choice's values (`devils-bargain`) have no text keys, so apps show them as
  written.

## License

License metadata: `mechanics-only`. The pack takes only mechanics and names from the
game's SRD, so it declares no text license. Its `credit` carries the SRD's attribution, which
apps show with the pack:

This work is based on Blades in the Dark (found at http://www.bladesinthedark.com/), product of
One Seven Design, developed and authored by John Harper, and licensed for our use under the
Creative Commons Attribution 3.0 Unported license (http://creativecommons.org/licenses/by/3.0/).

[`LICENSE`](https://github.com/pixelqueue/opencharacter/blob/main/packs/fitd/scoundrel/LICENSE)
gives the pack's terms: the contributors' own work in it is under CC0 1.0 (the repository's
default for packs), and the SRD's material stays under CC-BY 3.0 with the attribution above. The
pack has no other notices.
