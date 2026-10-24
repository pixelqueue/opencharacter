# Forged in the Dark crew (mechanics only)

`@opencharacter/fitd-crew` is an **unofficial, mechanics-only** model of a Forged
in the Dark crew for the [Open Character Format](https://opencharacterformat.org), built from the
game's System Reference Document (SRD) only: the crew sheet's tier, rep, heat, upgrades, cohorts, claims and
faction status, and the crew's rolls, as data an OCF engine runs. It is for app developers who
want Forged in the Dark crews beside the scoundrels of
[`@opencharacter/fitd-scoundrel`](https://github.com/pixelqueue/opencharacter/tree/main/packs/fitd/scoundrel).

It is not affiliated with or endorsed by One Seven Design or John Harper. It carries no rules
text, flavor text, art or logo from the game or the SRD: the text in `i18n/en.yaml` is names and
short descriptions written for the pack.

## Install and load

```sh
pnpm add @opencharacter/engine @opencharacter/fitd-crew @opencharacter/fitd-scoundrel
```

A crew is its own character file, loaded with this pack instead of the scoundrel pack
([an example crew](https://github.com/pixelqueue/opencharacter/blob/main/examples/characters/fitd-crew-ravens.yaml)).
Each scoundrel links to it through the scoundrel pack's `crew` slot, and the app passes the
crew's computed values as the link's view:

```ts
import { computeSheet, loadRuleset } from '@opencharacter/engine';
import crewPack from '@opencharacter/fitd-crew';
import scoundrelPack from '@opencharacter/fitd-scoundrel';

const crewRules = loadRuleset([crewPack]);
const scoundrelRules = loadRuleset([scoundrelPack]);
if (!crewRules.ok || !scoundrelRules.ok) throw new Error('packs failed to load');

const crewSheet = computeSheet(crewRules.ruleset, crew); // crew: the crew's character file
const view = {
  id: crew.id,
  values: Object.fromEntries(Object.entries(crewSheet.values).map(([k, v]) => [k, v.value])),
};
// scoundrel.links: { 'fitd-scoundrel:crew': crew.id }
const sheet = computeSheet(scoundrelRules.ruleset, scoundrel, [], {
  'fitd-scoundrel:crew': view,
});
```

The scoundrel pack reads the crew's tier, Mastery, Workshop, Training and Quality upgrades, its
Rigging and `members.*` fields, and sends heat to it (`to: { link: crew }`, applied to the crew
file). Neither pack depends on the other. A new crew starts with `create-crew` (the guided start
`crew`, or `random`). The guide on
[packs and rulesets](https://opencharacterformat.org/guides/packs-and-rulesets/) covers loading,
and [other characters](https://opencharacterformat.org/guides/other-characters/) covers links.

## Scope: the SRD only

The pack holds only what the game's SRD (CC-BY 3.0, <https://bladesinthedark.com>;
source text at <https://github.com/amazingrando/blades-in-the-dark-srd-content>) contains on
crews: One Seven Design's terms put the setting and the other non-SRD material off limits. The
SRD's crew playbook is a template, so the pack has:

- **No named crew types.** Each table makes its own ("three to six options are good", the SRD
  says), as homebrew `crewType` items (below). Without one, a crew takes its abilities and
  favored operation from the SRD's pools.
- **The SRD's 16 crew special abilities** as one pool: Deadly, Death Veil, No Traces, Patron,
  Predators, Fiends, Forged in the Fire, War Dogs, Anointed, Accord, High Society, Pack Rats,
  Second Story, Synchronized, All Hands and Just Passing Through.
- **The SRD's upgrades:** the lair (Boat and Carriage, Hidden, Quarters, Secure, Vault, Workshop),
  Training (Insight, Prowess, Resolve and Playbook, here "Personal"), Mastery, Quality (Documents,
  Gear, Implements, Supplies, Tools, Weapons), cohorts, and its examples of a crew type's own
  upgrades: Rigging, Prison Contacts, Elite cohorts (one per gang type), Hardened, Composed,
  Underground Maps and Passkeys, and Camouflage.
- **The SRD's 34 claims:** its 29 sample claims (Turf and 28 more) and the 5 prison claims (an
  Allied Claim is a claim marked `allied`).
- **Cohorts:** gangs (Adepts, Rooks, Rovers, Skulks, Thugs) and experts, with the SRD's four
  edges and four flaws.
- **The operations the SRD names** (20), for the hunting grounds' favored operation and the
  claims' payoff.
- Lair, hunting grounds, tier, hold, rep, turf, heat, wanted level, coin, crew xp and advancement,
  payoff, incarceration, entanglements and faction status, as the SRD gives them.

It names no factions, people or places: the GM defines the factions.

## What's modeled

- **Tier** (0 to IV) and **hold** (strong or weak), as inputs; the tier in prison (+1 with
  Prison Contacts).
- **Rep:** a track of 12, one shorter for each turf claim held (up to 6), never shorter than 6.
  Fiends counts each wanted level as turf, Accord up to three factions at +3 status. Turf gained
  with more rep marked than the shorter track holds leaves it full.
- **Heat** (0–9) and **wanted level** (0–4). Heat reaching 9 raises the wanted level by 1 and
  clears heat; heat past 9 carries over in the same change.
- **Crew coin:** 4, or 8 and 16 with the Vault's two boxes.
- **Crew special abilities** (`abilities.crew`): one, plus one per ability advance, from the
  pool (the rules-level choice `crew-abilities`), or from a homebrew crew type's own list. With
  mechanics: Patron, Fiends, Accord, Death Veil, No Traces, High Society, Just Passing Through,
  War Dogs, Predators, Second Story, and those the members read (below).
- **Upgrades as the boxes marked:** each is an integer, so an advance's two boxes are an
  allocation. Mastery takes four boxes, Hardened and Composed three, the Boat, Carriage, Secure
  lair and Vault two. The Rigging names the two kinds of item it carries free (the choice
  `rigging`). Boxes marked, cohorts included, are checked against those earned (`upgrade-boxes`:
  two starting upgrades, two more at creation, two per upgrade advance). A found Hidden lair
  moves for the tier in coin (`relocate-lair`).
- **A table's own crew type** (homebrew, of the `crewType` type): it lists its own upgrades
  (`upgrades`), its starting upgrades and starting gang (`startingCohort`: a gang type, or `none`; counted in the boxes earned), its claim
  map (`claims`), and its own `special-ability` and `operation` choices. With one, another type's upgrades are a rules issue (`special-upgrades`);
  without one, every crew-specific upgrade is open.
- **Cohorts** as copies: a gang (one of five types, and an optional second type) or an expert
  (its type in words). Each has a label, one or two edges and as many flaws, and harm 0 to 4
  (weakened, impaired, broken, dead). A cohort costs two upgrade boxes and a second type two more.
  Quality and scale are computed: a gang's are the tier, an expert's quality the tier + 1 at
  scale 0; Training Rooms adds 1 to the scale of the gang type its copy names.
  - `cohort-roll`: the cohort's quality in dice for a task of its type, 0 for anything else;
    −1d impaired, +1d for an Elite type. A broken cohort acts only when commanded by a member with
    Leader (+1 effect).
  - `cohort-recover` heals a level of harm in downtime, two with a scoundrel's help;
    `replace-cohort` replaces a dead one for the tier + 2 coin.
- **Advancement:** crew xp (8). A full track offers `crew-advance`: a new special ability (with a
  crew type, asked in its own `special-ability` choice only) or two upgrade boxes; xp clears, and
  the outcome's `stash` (tier + 2) is for each member's sheet.
  `develop` on a full rep track: weak hold becomes strong, or strong hold pays the new tier × 8
  coin (half with Patron, 2 less with Hardcase) to raise the tier and drops to weak; rep clears.
- `tier-roll`: a fortune roll of the tier (a Secure lair against an intruder).
- **Claims** as copies, one per claim held, with the players' `label` for the place and the
  faction it came from. `lair.lost` turns off the lair claims' benefits.
  - Turf counts toward rep (at most 6, `turf-limit`).
  - Income claims (Protection Racket, Vice Den, Fighting Pits, Side Business) have
    `claim-income`: a tier roll, coin equal to the highest die less heat (halved at war), up to
    the crew's capacity.
  - `payoff` after a score: rep (2, ± the target faction's tier against the crew's; none for a
    quiet operation, half with No Traces), coin, and heat (+1 high profile, +1 hostile turf, +2
    killing unless Death Veil, +1 at war), plus the claims' coin, Cover Operation's −2 heat and
    Victim Trophies' +1 rep, less a tithe (the tier + 1) when the crew pays one. Rep and heat go
    on the sheet; the coin is the outcome's, for the players to divide.
  - `engagement-roll`: 1d, the GM's net advantages, and the plan's dice from claims (City
    Records, Cover Identities, Ancient Altar, Secret Pathways) and from Second Story and
    Predators.
  - `incarceration-roll`: the tier in prison, +1d per Guard Payoff; the wanted level drops by 1
    and heat clears; a critical gives +3 rep; a 6 or critical wins a prison claim (or an Allied
    Claim, never turf nor on the crew type's own map) and +1 status with a faction helped
    inside; a 1–3 marks a trauma on the member passed as `prisoner` (none with Cell Block
    Control). The outcome gives the sentence's wanted level, 1 lower with Parole Influence.
  - `seize-claim`: the claim, −2 status with the faction it was taken from, and +1 with any of
    its enemies the crew names.
- **Factions the GM defines:** `add-faction` adds a copy of the generic faction with the GM's
  name for it, its tier, hold and the crew's status; a homebrew item of type `faction` is a
  standard copy on every crew. Each copy's `status` (−3 to +3) is changed with `faction-status`;
  its `tier` and `weakHold` follow the faction in play. Creation picks a faction already on the
  sheet, or adds one by the name the players give it (below). `payoff` and
  `resolve-entanglement` take the faction's tier as a parameter when there is none. **War** with any faction: +1 heat per score, half income from claims, a hold
  lost and, with weak hold, a tier, and one downtime activity per member (War Dogs keeps the
  hold, the tier and two activities).
- **Entanglements:** `entanglement-roll` (the wanted level in dice, read in the heat column; the
  GM picks one of the two the table gives; a Cooperation with no faction at +3 is avoided) and
  `resolve-entanglement` (paying, forfeiting rep or coin by the faction's tier, losing status,
  war, giving up a claim or hold, handing someone over, or the questioning roll). The harm a
  member suffers is the outcome's `harm`.
- **The crew's downtime** (`crew-downtime`, once per downtime): High Society's and Just Passing
  Through's −1 heat, and No Traces' +1 rep with no heat left.
- **For members** (`members.*`, read by the scoundrel pack): Deadly's dots as a count and the
  ratings they offer; dice for resistance (Forged in the Fire), against the supernatural
  (Anointed), asset rolls (Pack Rats, Warehouses), recovery (Infirmary), gathering information
  (Informants) and about the elite (High Society), passing as ordinary citizens (Just Passing
  Through); Synchronized group actions; the ratings a held claim's site helps; the prison load
  (Smuggling). The quality of the members' items of each kind and the extra stress and trauma
  box (a full Composed or Hardened) are exposed too.
- **Contacts** as copies with the players' name for each; one may be the favorite. Hunting
  grounds, lair and reputation are the players' words; the crew's name is the app's.
- **Creation:** a guided start, `crew`, and a random one, `random`, following the SRD's steps.
  `create-crew` asks for a crew type only when the table has made one. Without one, it takes a
  special ability (Deadly, the SRD's first, is recommended) and the favored operation from the
  pools, and the crew marks its two starting upgrades itself (any upgrade). With one, the type's
  starting upgrades and gang are marked for it and its own choices are asked with the pending
  picks. Then 2 coin; the hunting grounds (1 coin for room to work, 2 for +1 status, or nothing
  and −1 status); two more upgrade boxes or a new gang or expert; the statuses the upgrades and
  the favorite contact bring; the pending picks (a type's choices, the Rigging's kinds); the
  players' words; and `finishCreation`.
  - **Factions at creation:** run `add-faction` first for each faction the GM has defined, or
    pass the factions' names as `create-crew`'s params (`groundsFaction`, `helpedFaction`,
    `harmedFaction`, `friendFaction`, `enemyFaction`). A step whose name is given adds a new
    faction with that name and the status the step brings (its tier and hold for the GM to set);
    a step without one picks a faction on the sheet, factions the earlier steps added included.
    A status with neither (no faction on the sheet and no name, as in a random start on a blank
    crew) is only reported in the outcome (`groundsStatus`, `helpedStatus`, `harmedStatus`,
    `friendStatus`, `enemyStatus`) for the GM to record.
  - The SRD creates crews by choice, so the random start's odds are the pack's: every pick
    uniform over what the guided start offers, the upgrade boxes one at a time to an upgrade with
    a box free (leaving out Mastery and the three-box upgrades), and every faction status drawn
    (on a faction named or on the sheet, when there is one).
- **Sheet layout:** display groups for actions (crew rolls, after the score, crew downtime,
  factions, crew creation) and content (crew type, abilities, claims with turf first, cohorts by
  kind, cohort traits, contacts with the favorite first, operations, factions). The crew-specific
  upgrades show all of them without a crew type, a homebrew type's own with one.

## Add-on packs

A pack that depends on `fitd-crew` (a crew-type or setting pack) adds content of its types:
crew types, crew abilities, operations, claims, cohort traits, contacts and factions join the
creation picks, the random start's draws and the advance's picks as the core's do (the SRD has
no crew types, so a crew-type pack's are the ones offered).

- **Gang types** are the family `fitd-crew:gang` (adepts, rooks, rovers, skulks, thugs). An
  add-on adds one by adding it to the family (`families: { 'fitd-crew:gang': [sappers] }`),
  declaring its `upgrades.elite.<type>` field (tagged `upgrade.special`), and adding the value to
  the open enums that hold a gang type: `fitd-crew:types.crewType.fields.startingCohort`,
  `fitd-crew:types.claim.fields.scaleGang`, `fitd-crew:types.cohort.state.gangType`,
  `fitd-crew:types.cohort.state.extraGangType` and `fitd-crew:types.claim.state.trainedGang`,
  named in its text under the core's keys. The creation's gang pick offers the family's types,
  the add-on's named by its `actions.create-crew.options.<type>.name` (found through the
  ruleset's `familyOrigins`), and elite and claim scale read them by key. A claim like Training Rooms sets `trainsGang` to
  show its `trainedGang` pick.
- **Tagged steps**, for an add-on's rules-level `option` effects: `creation.crew-type`,
  `creation.ability`, `creation.operation`, `creation.more` (two upgrades or a cohort) and
  `creation.gang` of `create-crew`, and `advance.crew` (`crew-advance`'s pick); for its
  `changes` effects, `creation.start` (starting coin, upgrades and cohort).
- **Closed:** a cohort's `kind` (gang or expert), a faction's hold, the six plans and the
  payoff targets, which the core's rules read.

## Text only

- All Hands: the SRD doesn't say what the cohort rolls, and downtime activities are
  the app's.
- Upgrades: the vehicles themselves, Quarters, Underground Maps and Passkeys, Camouflage.
- Cohort edges and flaws: decided in play.

## Out of scope

- The setting: factions, people and places, the map and the claim maps of the book's crew types.
- Teamwork between members: the scoundrel pack's group action and assist.
- Why a faction rises or falls on the ladder, and the factions' own clocks: the GM's; the crew
  sheet tracks where each stands.
- Extra downtime activities bought with coin or rep, and the boss's patience clock when a tithe
  goes unpaid: the app's or the GM's.

## Rule readings

- **SRD only:** no named crew types, and only the SRD's 16 crew abilities, its upgrades
  (including its examples of a crew type's own, open to a crew without a type), 34 claims and
  20 operations. A table's own crew types and factions are homebrew or the GM's.
- **Random start:** the SRD creates crews by choice, so the odds are the pack's: every pick
  uniform over what the guided start offers, the two upgrade boxes one at a time (Mastery and
  the three-box upgrades left out, since two boxes can't finish them), and every faction status
  recorded.
- **War and hold:** the SRD reads the hold lost to war as the war starts; the pack reads it while
  the war lasts, so it comes back when the war ends.
- **Heat** past 9 rolls over: 7 heat and 4 more is a wanted level and 2 heat.
- **Training Rooms** records its gang type on the copy, since the SRD leaves the type to the
  crew. The Offertory's occult operations are read as acquisition, consecration and sacrifice.
- **Claim maps** are a suggested order, not a rule, so they aren't enforced.

## Limitations

- A crew can't read its members (a link slot holds one character), so nothing on the crew sheet
  can count or sum over them, and an advance's stash is outcome data for the app. Crew actions
  take members as participants where one member matters (the prisoner, a cohort's commander).

## License

License metadata: `mechanics-only`, like `fitd-scoundrel`. The crew rules come from the
game's SRD; only mechanics and names are taken from it, so the pack declares no text
license. Its `credit` carries the SRD's attribution, which apps show with the pack:

This work is based on Blades in the Dark (found at http://www.bladesinthedark.com/), product of
One Seven Design, developed and authored by John Harper, and licensed for our use under the
Creative Commons Attribution 3.0 Unported license (http://creativecommons.org/licenses/by/3.0/).

[`LICENSE`](https://github.com/pixelqueue/opencharacter/blob/main/packs/fitd/crew/LICENSE)
gives the pack's terms: the contributors' own work in it is under CC0 1.0 (the repository's
default for packs), and the SRD's material stays under CC-BY 3.0 with the attribution above. The
pack has no other notices.
