# Rolling dice

Attacks, saving throws, FitD action rolls, Mothership panic checks, rests: anything that rolls
dice or makes an in-play decision is an **action**. The engine builds the roll, does all the dice
math, reads the result and proposes the changes that follow. Your app decides who rolls the dice,
how they look, and when to ask the player something.

## Which actions are available

`computeSheet` lists the actions the character can take now:

```json
"actions": [
  { "action": "5e-srd-5.1:weapon-attack", "entry": "inv-1" },
  { "action": "5e-srd-5.1:features.fighter.second-wind#second-wind", "entry": "fighter",
    "source": "5e-srd-5.1:features.fighter.second-wind" },
  { "action": "5e-srd-5.1:saving-throw" },
  { "action": "5e-srd-5.1:long-rest" }
]
```

- An action with an **`entry`** belongs to one of the character's copies: one attack button per
  equipped weapon. The same action can appear several times with different entries. The entry
  may also be one of the character's `applied` entries: a drunk potion that lets its drinker
  cast a spell for an hour offers the cast from the applied potion.
- **`source`** names the content the action comes from when it isn't the entry's own item (a
  class feature, a picked ability). Pass it back as is.
- Actions without an entry are the rules' own: saving throws, checks, rests.
- An action whose `available` condition is false (an unequipped sword) isn't listed.

Name them with `actions.<id>.name`, or `<item>.actions.<action>.name` for an ID with a `#`
([Text and translation](text-and-translation.md#from-an-id-to-a-key)).

## Running an action

```ts
const result = startAction(
  ruleset,
  character,
  {
    action: { id: '5e-srd-5.1:weapon-attack', entry: 'inv-1' }, // as computeSheet listed it
    params: { targetAc: 15 },
    situational: { '5e-srd-5.1:advantage': true },
    policy: { dice: 'auto', choices: 'auto' },
  },
  // optional dice function; the engine's own random dice by default
);
```

The result is one of three things:

| Result                                                  | Means                                                |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `{ status: 'finished', outcome, proposedChanges, log }` | Done                                                 |
| `{ status: 'paused', needs, state, log }`               | Waiting for dice faces or a choice                   |
| `{ ok: false, errors }`                                 | Couldn't run: a missing parameter, an unknown action |

### Parameters

Some actions take parameters: a target's AC, which skill to check, which rating to roll. They're
declared on the action (`ruleset.rules.actions[id].params` for rules actions), each with a type
and whether it's `optional`. A missing required one is the error `missing-param`; a number
outside its `min`/`max` is `out-of-range` (the bounds may read the character: at most the Effort
it has free).

A **field parameter** (`type: id, of: field`) takes a field ID: a FitD action roll takes the
rating to roll (`{ rating: 'ratings.skirmish' }`), and its `where` says which fields are allowed
(`'rating' in item.tags`). Offer the matching fields as a picker.

A **dice parameter** (`type: dice`) takes dice notation as a string (`'2d6 + 1'`) or a whole
number: a orc-2e bomb's damage, passed whole to the Strike that throws it.

### Situational choices

Situational choices are things the rules care about that the character sheet doesn't know:
advantage, cover, a GM's bonus, a FitD roll's position and effect. `computeSheet` lists the ones
on offer in `situational`, and their definitions (type, default) are in
`ruleset.rules.situational`. Show them as toggles or pickers next to the roll button, and pass the
selected ones in `situational`. Omitted choices take their defaults.

## Who rolls the dice

**By default the engine rolls.** That's right for most apps: instant results, nothing to set up.

**Supply your own dice function** to control randomness: a seeded roller for tests and replays, a
server that rolls for everyone so players can't cheat, or your platform's own random source:

```ts
const myDice = (count: number, sides: number | 'F', zero: boolean): number[] =>
  Array.from({ length: count }, () =>
    sides === 'F' ? secureInt(3) - 1 : secureInt(sides) + (zero ? 0 : 1),
  );

startAction(ruleset, character, input, myDice);
```

It gets a die count and size (`'F'` for Fate dice; `zero` for dice numbered from 0, like a
Mothership d10) and returns **individual faces**. The engine does everything else: keep and drop,
rerolls, explosions, critical hits.

**Pause for dice** when the faces should come from somewhere else: 3D dice your app animates,
physical dice the player types in, a dice bot. Set `policy: { dice: 'pause' }`:

```json
{
  "status": "paused",
  "needs": {
    "step": "attack",
    "action": "5e-srd-5.1:weapon-attack",
    "kind": "dice",
    "dice": [
      { "count": 2, "sides": 20 },
      { "count": 1, "sides": 4 }
    ],
    "items": ["…the built roll, for display while waiting…"]
  }
}
```

That's an attack with advantage (2d20, keep the higher) under Bless (+1d4). Roll the dice, then
answer with **one face per die, in order**:

```ts
const next = continueAction(ruleset, paused, { faces: [17, 9, 3] }, { dice: 'pause' });
```

If rolling needs more dice than that (a reroll, an exploding die), the action pauses again for
one die at a time. A wrong number of faces, or a face that isn't on the die, is the error
`answer-mismatch`.

**Rolling the whole roll twice.** Some rules roll a whole roll again and keep the better or
worse total (Ashes Without Number's "roll twice, keep the worse" on 2d6). Such a pause has
`needs.repeat: { times, keep }` (`keep` is `high` or `low`), and `needs.dice` lists every roll's
dice in turn: answer with the faces of the first roll, then the second. The log entry's `items`
and `total` are the kept roll's, its `faces` every face you gave, and `rolls` lists every roll as
`{ total, kept, items }`, so show both and mark the kept one. `text.dice(needs.items, needs.repeat)`
words it: "2d6, rolled twice, keep the lower total".

### Checkpoint policies

Every roll and every in-action choice is a **checkpoint**. The policy decides, for each one,
whether the engine continues by itself (`auto`) or pauses (`pause`). A roll with no dice (Fate's
final total, a flat damage) isn't one: it never pauses, and its log entry has no `faces`.

```ts
const policy = {
  dice: 'auto', // default for rolls
  choices: 'auto', // default for choices
  rules: [
    { kind: 'roll', tags: ['attack'], then: 'pause' }, // animate attack rolls
    { step: 'hit/confirm', then: 'auto' }, // take the recommendation here
  ],
};
```

The first matching rule wins; a rule matches by `kind`, any of the roll's or choice's `tags`, or
the step's path. Pass the policy to `startAction` and again to each `continueAction`. A choice without a
recommendation always pauses, whatever the policy says.

Common policies:

| App                            | Policy                                                           |
| ------------------------------ | ---------------------------------------------------------------- |
| Quick rolls in a sheet         | `{}` (everything automatic)                                      |
| 3D dice                        | `{ dice: 'pause' }`                                              |
| Players decide every choice    | `{ choices: 'pause' }`                                           |
| Physical dice for attacks only | `{ rules: [{ kind: 'roll', tags: ['attack'], then: 'pause' }] }` |

### Choices during an action

A choice checkpoint pauses with `needs.kind: 'choice'`, `needs.options` and, when the rules
recommend one, `needs.recommended`. Only the pack recommends: a pick it leaves open, such as a
guided start's race or class, has no `recommended`, so don't present the first option as advice.
In the 5E attack, when the app gave no target AC, the engine can't tell a
hit from a miss and asks:

```ts
continueAction(ruleset, paused, { option: 'hit' }, policy);
```

Reactions after a roll (Lucky, Inspiration, pushing yourself in FitD) are choices too, declared
by the pack.

Some choices offer the character's copies or the ruleset's content instead of a written list.
The 5E long rest asks which class regains a hit die, and offers instance IDs:

```json
{
  "step": "hitDice",
  "kind": "choice",
  "options": ["fighter", "barbarian", "#done"],
  "recommended": "fighter"
}
```

A choice like this may ask again, once per pick, with the same `step`; each pick is its own
log entry with an `index`. `#done` stops early. Name a copy option by its item's name, a
content option (a qualified content ID) by that item's name, and `#done` by the spec's
`actions.options.done.name`.

A choice can also offer plain values (a modular weapon's damage types, the character's trained
skills). Each option is the value as a string. Name it by `<actionKey>.options.<value>.name`
when the pack has that key; otherwise name it as a set member: a content ID by its item's name,
a field ID by the field's, a tag by the tag's (`text.option(id, { action: needs.action })` does this).

A character's abilities and items can add their own options to a choice. In FitD, pushing
yourself costs 2 stress, and a scoundrel with Battleborn may mark special armor instead:

```json
{
  "step": "pushCost",
  "kind": "choice",
  "options": ["stress", "fitd-scoundrel:special-abilities.battleborn#special-armor"],
  "recommended": "stress"
}
```

An added option is `<content id>#<option id>`; name it from that item's pack by
`<content id>.options.<option id>.name` (`special-abilities.battleborn.options.special-armor.name`).
It's never the recommendation, so an automatic run keeps the rules' choice. To ask the player
about every push, pause on the step's tag: `{ rules: [{ kind: 'choice', tags: ['push-cost'],
then: 'pause' }] }`.

### Showing a pause

Every pause names its `step` (the path, `hit/confirm`) and the `action` that defines that step
(`5e-srd-5.1:weapon-attack`). Build the text from `action` and the last segment of the path,
in that action's pack:

| What                     | Key (for `weapon-attack`)                    | Example              |
| ------------------------ | -------------------------------------------- | -------------------- |
| A choice's question      | `actions.weapon-attack.steps.confirm.prompt` | Did the attack hit?  |
| A choice's options       | `actions.weapon-attack.options.hit.name`     | Hit                  |
| A roll's name (optional) | `actions.weapon-attack.steps.damage.name`    | Damage               |
| A parameter's label      | `actions.weapon-attack.params.targetAc.name` | Target's Armor Class |

Use `action`, not the action you started: a Mothership stat check that fails critically runs a
panic check, and its pause is `step: 'panic/panic'`, `action: 'mothership-1e:panic-check'`.
An action on an item is `<item id>#<action id>` and its keys start with
`<item id>.actions.<action id>` ([Text and translation](text-and-translation.md)). A roll's
name is optional in packs; fall back to your own label ("Roll") when it's missing.

### What a roll is against

A dice pause's `needs.summary`, and each roll's log entry's `summary`, say what the roll is
rolled against, so a tile can read "Sanity: 1d100, roll under 34" before the roll and "Failure,
rolled 38 (needed under 34)" after:

```yaml
summary:
  bandSet: mothership-1e:check
  bands:
    - { band: critical-success, when: 'roll.total < 34 && roll.total < 90 && roll.total % 11 == 0' }
    - band: success
      when: 'roll.total < 34 && roll.total < 90'
      tests:
        - { of: roll.total, compare: lt, value: 34 }
        - { of: roll.total, compare: lt, value: 90 }
    - { band: critical-failure, when: 'roll.total % 11 == 0' }
    - { band: failure, when: 'true', tests: [] }
  flags: { target: 34 }
```

- `bands` are the bands the roll can still reach, each `when` with everything but the roll
  worked out (the save's 34). A band that can't hold is left out, and the list stops at one
  that always holds: a 5E attack with no AC ends at `rolled`, so show the dice without a
  target.
- `tests` are the plain comparisons, as codes (`lt`, `le`, `gt`, `ge`, `eq`). Word them with
  the pack's `bands.<set>.<band>.condition` text when it has one (Mothership's "Roll under
  {value} (90+ always fails)"), else the spec's `compare.<code>` text ("under {value}"). A
  band without `tests` (a natural 20, FitD's two 6s) has only its name and `when`.
- `flags` are the running action's flags, for displays that know the game (5E's `ac`, Fate's
  `opposition`).

To show a tile before the player rolls, start the action with `policy: { dice: 'pause' }`, read
`needs.summary` and throw the result away; nothing has changed. The first pause is the first
roll the action reaches, which may be a nested action's (`needs.action` names it). A target set
after the dice (Fate's opposition) is only in that later step's log entry.

### Paused actions are data

A paused result is plain JSON. It holds everything needed to continue: the character as it was
when the action started, the inputs and every answer so far. So you can:

- store it and continue minutes later;
- send it to the player's own device, so they roll on their phone while the GM's screen waits;
- continue it on a different server.

`continueAction` replays the action from the start with the recorded answers, so a paused action
needs nothing from memory. Pass the paused result back exactly as you got it.

### Keeping only the answers

A paused result holds the whole character, so a server shouldn't take one back from a browser.
Keep the answers instead (each exactly what you passed to `continueAction`) and replay them
against your stored character on each request:

```ts
const result = startAction(ruleset, character, {
  action: { id: 'fitd-scoundrel:create-scoundrel' },
  policy: { dice: 'pause', choices: 'pause', allocations: 'pause' },
  answers: [{ option: 'fitd-scoundrel:special-abilities.mule' }],
});
```

The result is what `startAction` and then `continueAction` with each answer would give: finished,
or paused at the next question. An answer that no longer fits fails with `answer-mismatch`, whose
`data.index` says which one and `data.needs` what was asked there. Only pauses take answers: if
the policy lets the engine roll, it rolls again on every replay, so pause dice and keep the faces
you rolled with the answers, or pass a seeded dice function.

## Reading the result

```json
{
  "status": "finished",
  "outcome": { "result": "hit", "data": { "critical": false, "attack": 27 } },
  "proposedChanges": [
    {
      "to": "target",
      "step": "deal",
      "change": {
        "type": "adjust",
        "field": "5e-srd-5.1:hp.current",
        "by": -13,
        "tags": ["damage", "damage.slashing"]
      }
    }
  ],
  "log": ["…one entry per checkpoint…"]
}
```

- **`outcome`** is the action's result as the pack defines it: `result` is a string (`hit`,
  `miss`, a FitD `success`), and `data` holds extra details. An action declares its possible
  results, so each has a name: `actions.weapon-attack.results.hit.name`, or the band's name
  (`bands.action.success.name`) when its results are a band set. `data` values have no names;
  format them yourself.
- **`proposedChanges`** are what the rules say should happen next. **Nothing is applied yet.**
  Changes `to: 'self'` go to the acting character; changes `to: 'target'` go to whoever the
  action was aimed at; changes `to: { link }` go to the linked character named by `character`,
  such as a FitD crew ([Other characters](other-characters.md)). `step` is the path of the step
  that proposed each one, so you can tell the damage (`deal`) from the healing in one list.
- **`log`** lists every checkpoint: its `step` and defining `action`, each roll's `faces`,
  itemized `items`, `total` and result `band`, each choice's `option`, and `by` (`engine` or
  `app`) for who supplied it.

### Applying proposed changes

```ts
const own = result.proposedChanges.filter((c) => c.to === 'self').map((c) => c.change);
const applied = applyChanges(ruleset, currentCharacter, own);
```

Apply them to the character **as it is now**, not the snapshot the action started from: other
changes may have happened while the action was paused. Your app can also let the player review
them first, or skip them (a GM overriding damage).

### Itemized rolls

Each roll is a list of structured items, not a display string:

```json
[
  {
    "kind": "dice",
    "count": 2,
    "sides": 20,
    "modifiers": [{ "type": "keepHighest", "count": 1 }],
    "faces": [
      { "value": 17, "kept": true },
      { "value": 9, "kept": false }
    ],
    "value": 17,
    "source": { "type": "item", "id": "5e-srd-5.1:weapons.longsword", "entry": "inv-1" }
  },
  {
    "kind": "flat",
    "value": 4,
    "source": { "type": "field", "id": "5e-srd-5.1:abilities.str.mod" }
  },
  {
    "kind": "flat",
    "value": 2,
    "source": { "type": "field", "id": "5e-srd-5.1:proficiency.bonus" }
  },
  {
    "kind": "flat",
    "value": 1,
    "source": {
      "type": "template",
      "id": "5e-srd-5.1:magic-items.weapon-plus-one",
      "entry": "inv-1"
    }
  },
  {
    "kind": "dice",
    "count": 1,
    "sides": 4,
    "faces": [{ "value": 3, "kept": true }],
    "value": 3,
    "source": { "type": "item", "id": "5e-srd-5.1:spells.bless" }
  }
]
```

Build your own labels from it: **27 = 17 (2d20, kept higher) + 4 Strength modifier + 2
Proficiency bonus + 1 Longsword +1 + 3 Bless**. Each item has one source, so every number has
exactly one name. The dice modifiers are a fixed set
([dice-modifiers.json](../../../packages/spec/data/dice-modifiers.json)), so you can describe them
in words ("kept the higher die").

**Result bands** say how to read a roll in games that read results by range (FitD's 6 / 4–5 /
1–3, Powered by the Apocalypse's 10+ / 7–9 / 6−). A roll's `band` in the log is the band ID and
`bandSet` the set's qualified ID (`fitd-scoundrel:action`); its name is
`bands.<set>.<band>.name` in the set's pack (`bands.action.success.name`).

**One roll, several bands.** A roll compared with several creatures (orc-2e's Hide
against each observer) is rolled once and classified again for each one: those log entries have
`of`, the path of the roll they read (`check/roll`), the same `items` and `total`, their own
`band`, and no `faces`. Show them as that roll's result against each creature, not as more
rolls.

**Roll tallies** count things beside the total (FitD's effect level). They're in
each roll's `tallies` in the log, with what contributed to them.

**Bounds** raise or lower a roll's total once it is rolled (5E's Indomitable Might: a Strength
check is at least the Strength score). The log's `total` is the bounded one, and its `bounds`
lists each bound that changed it (`{ source, op, value }`); the items keep their own values, so
show the bound beside them ("7, raised to 20").

### History and replay

The log records every face and choice, however supplied. Keep it for a roll history or a combat
log. The engine is deterministic given its answers: running the same action on the same
character with the same faces and choices gives the same result, which is handy for checking a
disputed roll. `diceFrom(faces)` makes a dice function that hands out given faces in order.

## Next

- [Other characters](other-characters.md): targets, monsters, effects cast on others.
