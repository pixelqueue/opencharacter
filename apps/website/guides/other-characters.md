# Other characters

Every engine call works on **one character**. Combat, spells cast on allies and monsters all
involve several, so your app does the routing: it reads one character's numbers, passes them to
another's action, and applies changes to whoever they're for.

## Attacking a target

An action that involves other characters declares **roles** (`target`, `helper`). You pass the
characters filling each role as **participants**: per role, a list of **views**, each the
character's `id` and its computed values. The engine reads only the fields the role declares,
and changes meant for a participant come back naming it in `character`:

```ts
// A view: the character's ID and its computed values (pass them all; extra ones are ignored).
const view = (character, sheet) => ({
  id: character.id,
  values: Object.fromEntries(
    Object.entries(sheet.values)
      .filter(([, v]) => v.value !== undefined)
      .map(([id, v]) => [id, v.value]),
  ),
});

// 1. Compute the target's own sheet, with its own ruleset.
const goblinSheet = computeSheet(goblinRuleset, goblin);

// 2. Run the attacker's action with the target. Its AC (15) and conditions come from the view.
const attack = startAction(ruleset, tamsin, {
  action: { id: '5e-srd-5.1:weapon-attack', entry: 'inv-1' },
  participants: { target: [view(goblin, goblinSheet)] },
});

// 3. Apply each change to the character it names, with that character's ruleset.
if ('status' in attack && attack.status === 'finished') {
  const forGoblin = attack.proposedChanges
    .filter((c) => c.character === goblin.id)
    .map((c) => c.change);
  const hit = applyChanges(goblinRuleset, goblin, forGoblin);
  // hit.adjustments: [{ field: '5e-srd-5.1:hp.current', by: -7, requested: -13,
  //                     taken: -13, reason: 'requested', clamped: true }]
}
```

- **The attacker's rules read the target's view.** A prone goblin (its sheet says
  `conditions.prone: true`) gives a ranged attack disadvantage; a restrained one gives advantage.
- **Without participants** the action still works: pass `params: { targetAc }`, or let it ask
  "hit or miss?", and route the `to: 'target'` changes yourself (they carry no `character`).

- **Resistances apply on the target's side.** The attack proposes 13 slashing damage with tags
  (`damage`, `damage.slashing`); the target's `applyChanges` runs it through the target's own
  resistances, temporary hit points and bounds. The goblin had 7 HP, so it took 7 (`clamped`).
- **Each character uses its own ruleset.** The target may pin different pack versions, or be from
  a monster pack, so apply its changes with the ruleset for its own `packs`.
- **The target is your app's concept.** The engine knows targets only by the IDs you give their
  views; it never loads their files.
- **What happens at 0 HP** (dying, unconscious, removed from the map) is up to your app and the
  pack's own fields and actions (a death save is an action).

## Several targets and handoffs

An area spell has several targets, and each makes its own saving throw on **its own sheet**:
its bonuses, its conditions, its dice. The engine can't compute that sheet, so it **hands the
step off** to you: the action pauses with `needs.kind: 'handoff'`, naming the participant and
the action to run on it. You run that action on the participant's character and answer with its
outcome:

```ts
let cast = startAction(ruleset, wizard, {
  action: { id: '5e-srd-5.1:cast-spell', entry: 'wizard', source: '5e-srd-5.1:spells.fireball' },
  participants: { target: [view(goblin1, sheet1), view(goblin2, sheet2)] },
});
while ('status' in cast && cast.status === 'paused' && cast.needs.kind === 'handoff') {
  // needs.participant: { role: 'target', id: 'goblin-1' }
  // needs.run: { action: '5e-srd-5.1:saving-throw', params: { ability: 'dex', dc: 14 } }
  const who = byId[cast.needs.participant.id];
  const save = startAction(rulesetFor(who), who, {
    action: { id: cast.needs.run.action },
    params: cast.needs.run.params,
  });
  // (save may pause for its own dice or choices; continue it the usual way.)
  cast = continueAction(ruleset, cast, { outcome: save.outcome });
}
// cast.proposedChanges: the damage roll's full or half damage for each goblin, by `character`.
```

- **A handoff always pauses**, whatever the policy, because only you can run the other sheet.
  If you want it automatic, run it at once and continue, as above.
- **The participant's own changes are yours to apply.** The outer action only sees the
  outcome; whatever the saving throw proposes belongs to the goblin.
- **The log records each answer** (`kind: 'handoff'`), so a paused action replays exactly.
- **A handoff may name other characters for the run**: `needs.run.participants` lists IDs by
  role, the running character's own `id` included. Pass their views as the run's
  `participants`, as you would to any action. A Fate attack names the attacker this way, so the
  defender's Riposte can hit back.

A FitD **assist** works the same way: pass the helper as `participants: { helper: [...] }` to
`action-roll`; the roll gains the die and proposes 1 stress for the helper.

## An app with one sheet

An app that holds only the player's character still runs actions with roles: a MÖRK BORG Speak
Truth or Horn for a recipient, a Fate free invocation passed on, a FitD cohort roll with its
commander. `describeAction`'s `participants` lists each role with its `min` and `max`
([Rolling dice](rolling-dice.md#describing-an-action)).

- **A role without a minimum** (`min: 0`: the Horn's recipient, a cohort roll's commander, the
  incarceration roll's prisoner, a 5E attack's target): start the action without it. A step
  over the role (`each`, a handoff) doesn't run, a formula sees the role as `[]`, and a change
  for it is proposed once with `to: '<role>'` and no `character`.
- **A role with a minimum** (`min: 1`: Speak Truth's and a passed invocation's recipient):
  started without one, the action fails with `invalid-participants` (`data.role`). Pass a
  **stand-in view**, `{ id, values: {} }`, with an ID of your own: the role's declared fields
  read their defaults, and its changes come back with that ID as `character`.
- **Apply only the character's own changes**: those with `to: 'self'` and no `character`. Show
  the others as what the other character gains, for the table to apply: "The recipient gains
  Clarity" (`text.content(change.source)`, `text.field(change.field)`).
- **When the player's character is the one it's for**, where the rules allow it, pass its own
  view in the role: the changes for the role then carry its `id`, and you apply them too.
- **A handoff to the stand-in** pauses as usual. Without the other sheet, ask the player how it
  went and answer with one of `needs.run.action`'s results: `{ outcome: { result: 'success' } }`.

```ts
const speak = startAction(ruleset, hermit, {
  action: { id: 'mork-borg-core:speak-truth' },
  participants: { recipient: [{ id: 'recipient', values: {} }] },
});
// speak.proposedChanges:
// [
//   { to: 'self', step: 'spend',
//     change: { type: 'adjust', field: 'mork-borg-core:daily.truths', by: 1 } },
//   { to: 'recipient', character: 'recipient', step: 'clarity',
//     change: { type: 'applyEffect', source: 'mork-borg-core:boons.clarity' } },
// ]
const own = speak.proposedChanges.filter((c) => c.to === 'self' && c.character === undefined);
applyChanges(
  ruleset,
  hermit,
  own.map((c) => c.change),
);
// The recipient's change: "The recipient gains Clarity", for the table.
```

## Effects cast on someone else

When one character casts Bless on three allies, the spell's effects belong to the allies, not
the caster. Add an `applied` entry to each target:

```ts
for (const ally of allies) {
  applyChanges(rulesetFor(ally), ally, [
    { type: 'applyEffect', id: `bless-${castId}`, source: '5e-srd-5.1:spells.bless' },
  ]);
}
```

Content in a character's `applied` list runs only its effects meant for whoever it's applied to,
so a caster who merely knows Bless doesn't bless themselves. When Bless ends (its duration runs
out, or concentration breaks), remove it from every ally. The engine never tracks time, so keep
the cast's targets and duration in your own data, for example keyed by `castId`.

## Monsters and NPCs

Monsters and NPCs are character files like any other: a stat block is a character with mostly
fixed values and a few owned items or traits
([`5e-goblin.yaml`](../../../examples/characters/5e-goblin.yaml)). Everything in these guides
works for them: compute their sheet, run their attacks, apply damage to them.

- Keep one file per monster **type** as a template, and give each monster in an encounter its own
  copy with its own `id`.
- A monster's actions come from its items and the rules. In the 5E pack a stat block is a
  `monster` item that grants its attacks, run by `monster-attack` with the stat block's own
  numbers, and the `monster` creation start makes a monster's sheet from it.

## Linked sheets

Some characters lean on another one for as long as they exist. A FitD crew is its own sheet,
and its tier and upgrades change every scoundrel in it. The rules declare a **link slot** for
it, the scoundrel's file says who fills it, and your app passes that character's numbers in:

```yaml
# fitd-vex.yaml
links:
  fitd-scoundrel:crew: example-fitd-crew-ravens
```

```ts
// 1. Compute the crew with its own ruleset (it uses the crew pack, not the scoundrel pack).
const crewSheet = computeSheet(crewRuleset, ravens);

// 2. Pass it as the link's view: its ID and its values.
const values = Object.fromEntries(
  Object.entries(crewSheet.values)
    .filter(([, v]) => v.value !== undefined)
    .map(([id, v]) => [id, v.value]),
);
const links = { 'fitd-scoundrel:crew': { id: ravens.id, values } };
const vexSheet = computeSheet(ruleset, vex, [], links);
// vexSheet.values['fitd-scoundrel:ratings.max'].value: 4 when the crew has Mastery

// 3. Actions take the same links, and changes for the crew come back routed to it.
const used = startAction(ruleset, vex, {
  action: { id: 'fitd-scoundrel:use-creation', entry: 'lamp' },
  links,
});
if ('status' in used && used.status === 'finished') {
  const forCrew = used.proposedChanges
    .filter((c) => typeof c.to === 'object' && c.character === ravens.id)
    .map((c) => c.change);
  applyChanges(crewRuleset, ravens, forCrew); // +1 heat for a conspicuous creation
}
```

- **A view is just values.** The engine reads only the fields the slot declares, so you may
  pass every value of the linked sheet. It never computes the crew itself. A declared field may
  be a list of strings, such as the ratings the crew's dot abilities let a member pick from;
  the member's choice offers them (`listOptions` with the same links).
- **Compute the linked sheet first.** Links should point one way (scoundrel to crew), so
  compute the crew, then its members. After the crew changes, recompute the members.
- **A saved link without a view** reads the slot's defaults (tier 0, no Mastery), so always pass
  the view when you have the linked character.
- **The rules may ask you to make the linked sheet.** A MÖRK BORG Fanged Deserter's gore-hound
  is its own character, linked from the Deserter. While its slot is empty, the Deserter's
  `offers` holds a derived offer with `create` instead of an action:

  ```ts
  sheet.offers;
  // [{
  //   id: 'mork-borg-core:hound-sheet',
  //   kind: 'derived',
  //   followUp: 'mork-borg-core:hound-sheet',
  //   to: 'self',
  //   required: false,
  //   create: {
  //     link: 'mork-borg-core:hound',          // the empty slot
  //     start: 'mork-borg-core:companion',     // the creation start, <pack>:<id>
  //     pack: 'mork-borg-core',                // the pack the new character uses
  //     params: { companion: 'mork-borg-core:companions.ancient-gore-hound' },
  //   },
  // }]
  ```

  To take it, make a character file with that `pack` and `creating: true`, run the start
  (`ruleset.creation`'s entry with that `pack` and `id`) with `params` over the start's own,
  guided or, for a `random` start, automatically, and apply its changes. Then save the new
  character's ID in the owner's `links` under `link`: the offer is gone on the next
  `computeSheet`. It is optional (`required: false`): an app that doesn't link sheets can
  leave it, and the owner's rules work without the companion's sheet.

- **A paused action keeps its views:** `continueAction` takes none, so the result doesn't change
  if the crew does in the meantime.
- **Follow-ups can be for the linked character.** A pack may say that a change to this
  character calls for something on the linked one (`to: { link }`). It is stored on this
  character (one `applyChanges` writes one file) and listed in this character's `offers` with
  the linked character's ID in `character`. Look there for the linked sheet's offers: run its
  action on that character's own sheet, then clear it here with
  `{ type: 'clearFollowUp', id }` ([changing characters](changing-characters.md#what-the-rules-call-for-next)).

## Damage dealt to a target

The target's damage reaches it through its own `applyChanges`, so the target's rules decide what
follows: a concentration check, a failed death save, a wound roll. Apply the attacker's proposed
changes to the target and look at the target's `offers` (its stored follow-ups). Follow-ups never go to an action's
other participants: `applyChanges` doesn't know which action caused a change.

## Group actions

A FitD **group action** (`group-action`) has every member roll, takes the best result and
costs the leader 1 stress per bad outcome. Start it on the leader's sheet with the other members
as `member` participants. The leader's roll happens on that sheet; each member's `action-roll`
is a handoff: run it on that member's sheet (their pushes and xp are theirs) and answer with its
outcome. The action reduces the list of results with the list functions (`maxList`,
`countList`; [formulas](../../../packages/spec/docs/formulas.md#aggregates)) and proposes the leader's stress.

## Next

- [Upgrading characters](upgrading-characters.md).
