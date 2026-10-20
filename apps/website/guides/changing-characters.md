# Changing characters

Your app never edits a character file directly. Every change, from typing a new Strength score to
taking damage to levelling up, goes through `applyChanges`:

```ts
const result = applyChanges(ruleset, character, changes);
if (result.ok) {
  character = result.character; // save it
  showWarnings(result.issues); // rules issues: applied, but the rules object
} else {
  showError(result.errors); // nothing was applied
}
```

`applyChanges` works like a reducer: it returns a new character and never mutates the one you
pass in. The same changes on the same character always give the same result
([Storing characters](storing-characters.md#change-logs-undo-and-sync)).

## The change types

There's a small, fixed set of generic change types
([change.schema.json](../../../packages/spec/schemas/change.schema.json)). What's inside a change (does
this field exist, is 25 in range) is checked against the ruleset.

| Type             | Does                                                             | Example                                                                                         |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `set`            | Sets an input field                                              | `{ type: 'set', field: '5e-srd-5.1:abilities.str.base', value: 16 }`                            |
| `adjust`         | Adds to a numeric input field, through resistances               | `{ type: 'adjust', field: '5e-srd-5.1:hp.current', by: -10, tags: ['damage.fire'] }`            |
| `addItem`        | Adds a copy of content to `inventory` or `features`              | `{ type: 'addItem', entry: { id: 'inv-6', item: '5e-srd-5.1:weapons.dagger' } }`                |
| `removeItem`     | Removes a copy, with its picks                                   | `{ type: 'removeItem', entry: 'inv-6' }`                                                        |
| `equip`          | Equips or unequips a copy                                        | `{ type: 'equip', entry: 'inv-4', equipped: true }`                                             |
| `setState`       | Sets a per-copy state value                                      | `{ type: 'setState', entry: 'inv-2', key: 'ignited', value: true }`                             |
| `adjustState`    | Adds to a numeric per-copy state value                           | `{ type: 'adjustState', entry: 'fighter', key: 'level', by: 1 }`                                |
| `applyTemplate`  | Applies a template to a copy                                     | `{ type: 'applyTemplate', entry: 'inv-6', template: '5e-srd-5.1:magic-items.weapon-plus-one' }` |
| `removeTemplate` | Removes a template from a copy                                   | `{ type: 'removeTemplate', entry: 'inv-6', template: '…' }`                                     |
| `applyEffect`    | Starts a temporary effect from content not owned                 | `{ type: 'applyEffect', id: 'bless-1', source: '5e-srd-5.1:spells.bless' }`                     |
| `toggleEffect`   | Turns a temporary effect on or off                               | `{ type: 'toggleEffect', id: 'bless-1', active: false }`                                        |
| `removeEffect`   | Removes a temporary effect                                       | `{ type: 'removeEffect', id: 'bless-1' }`                                                       |
| `choose`         | Picks an option for a choice                                     | `{ type: 'choose', path: { entry: 'fighter', choice: ['fighting-style'] }, option: '…' }`       |
| `unchoose`       | Un-picks an option, and everything nested under it               | `{ type: 'unchoose', path: { entry: 'fighter', choice: ['fighting-style'] }, option: '…' }`     |
| `setExtension`   | Replaces your app's own data                                     | `{ type: 'setExtension', namespace: 'com.example.vtt', value: { … } }`                          |
| `setHomebrew`    | Replaces (or, with `null`, removes) the character's own homebrew | `{ type: 'setHomebrew', homebrew: { content: [ … ] } }`                                         |

Every field and content ID is **qualified** with its pack. Entries (copies) are named by the
instance `id` you gave them.

A set of tags, such as 5E's `5e-srd-5.1:damage.resistances`, may take only some tags. Its field
in the ruleset lists them as `tagOptions`: offer those in your "Add" picker. A `set` with any
other tag fails with `invalid-option`.

`setState`, `adjustState`, `equip` and `removeItem` can also aim at copies by query instead of
one `entry`: `copies: { type, where }`, optionally with `limit`. Actions use this (a long rest
restores every class's hit dice); your app rarely needs to
([engine core](../../../packages/spec/docs/engine-core.md#applychanges)).

A pick can keep state too (a once-a-day feat's `used`): `setState` and `adjustState` then name
it with `path` and `option`, as `choose` does, or every matching pick with `picks: { where }`.
The character file keeps the value on the pick (`{ option, state: { used: true } }`). Actions
propose these for you; show a pick's state from its content's own display, as a copy's.

## Batches are all or nothing

`changes` is a list, and the whole list applies or none of it does. Group what belongs together:
a level-up is `adjustState` on the class's level plus the new picks, in one batch. If the third
change fails, the first two don't happen, and `errors[0].path` says which one failed
(`/changes/2`).

Changes apply in order, so later changes see earlier ones: add a class in one change, then pick
its fighting style in the next.

## Three kinds of problem

| Kind              | Example                                                                | Result                                |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| **Shape error**   | `equip` with no `equipped`; a number where text belongs                | Rejected                              |
| **Runtime error** | Equipping an item the character doesn't own; Strength set to `"hello"` | Rejected; character unchanged         |
| **Rules issue**   | A feat whose prerequisite isn't met; too many attuned items            | **Applied**, and reported in `issues` |

A runtime error means the result wouldn't be a valid character file, so it's never allowed:

```json
{
  "ok": false,
  "errors": [
    {
      "code": "wrong-type",
      "path": "/changes/0",
      "data": { "target": "5e-srd-5.1:abilities.str.base", "expected": "a whole number" }
    }
  ]
}
```

A rules issue means the file is valid but the game's rules object. Homebrew tables bend rules on
purpose, so by default the change goes through and you get the issues back to show as warnings.
Errors carry a code from [error-codes.json](../../../packages/spec/data/error-codes.json), and issues
one from [rules-issue-codes.json](../../../packages/spec/data/rules-issue-codes.json). To turn them
into text, see [Text and translation](text-and-translation.md#errors-and-issues).

You can catch shape errors before calling the engine by validating changes against
`change.schema.json`. That's useful at an API boundary, where changes arrive from clients.

### Strict mode

If your app enforces the rules (a sanctioned-play builder, a game server that doesn't trust its
clients), pass `strict`:

```ts
applyChanges(ruleset, character, changes, true);
// any rules issue rejects the batch: { ok: false, errors: [{ code: 'rules-issue', data: { issues } }], issues }
```

A common pattern is to let players do anything in a sheet editor (not strict) and run actions and
level-ups strictly on a server.

## Damage, healing and resistance

`adjust` is how you change counters: hit points, stress, ammunition fields, luck. Give it `tags`
when it's damage, so the character's own effects can modify it:

```ts
const result = applyChanges(ruleset, tamsin, [
  { type: 'adjust', field: '5e-srd-5.1:hp.current', by: -10, tags: ['damage.fire'] },
]);
result.adjustments;
// [{ field: '5e-srd-5.1:hp.current', by: -5, requested: -10, taken: -5, reason: 'requested' }]
```

Tamsin has fire resistance, so 10 fire damage became 5. **Your app doesn't apply resistances
itself**; it sends the damage with its type and the engine works out the rest:

- incoming-change effects (resistance, vulnerability, damage reduction, thresholds such as
  Mothership armor points, which also break the armor);
- absorbing fields (temporary hit points take damage first);
- overflow (FitD stress past its maximum becomes trauma, then resets);
- clamping to the field's bounds (HP doesn't go below 0).

`adjustments` lists what actually happened, step by step: each entry has the `field`, the amount
it took (`by`), and a `reason` (`absorbed`, `requested`, `overflow`, `reset`), with `requested`
and `clamped` where they apply; the `requested` entry also has `taken`, the amount after
resistances and before temporary hit points. Use it for the combat log: "Tamsin takes 5 fire
damage (resisted)".
When an effect also changes its own entry (Mothership armor breaking), that change follows as
`{ entry, key, value, source }`: "The vest breaks". When it ends its applied entry (oil that
burns away), it follows as `{ entry, removed: true, source }`: "The oil burns away".

Use `set` for values the player types in, and `adjust` for anything that happens in play. Only
`adjust` goes through effects, absorbing fields and overflow.

### Reactions to one change

Some choices are made by the character being hit, for that hit only: 5E's Uncanny Dodge halves
one attack's damage. The pack declares them as situational choices with `incoming`, and
computeSheet lists the ones offered in `situational`. Before applying a change, show the
receiving player the offered choices whose `incoming` matches it (its field and tags), and put
the ones they pick on the change:

```ts
applyChanges(ruleset, rogue, [
  {
    type: 'adjust',
    field: '5e-srd-5.1:hp.current',
    by: -9,
    tags: ['damage', 'attack', 'melee', 'nonmagical', 'damage.slashing'],
    situational: { '5e-srd-5.1:uncannyDodge': true },
  },
]);
// the 9 is halved to 4, for this change only
```

An attack split by damage type carries the choice on each of its changes. A choice that isn't
offered, or doesn't match the change, rejects the batch (`situational-unavailable`). The choice
stays on the change in `changes`, so log that: a replay halves it again. Spending the reaction
is your app's.

## What the rules call for next

Many rules ask for something more: a level-up when experience earns one, a concentration check
when a concentrating caster takes damage, a death save when a Mothership marine reaches maximum
wounds. Packs declare these as **follow-ups**, and `computeSheet` lists what the rules offer the
character now in `offers`. There are two kinds:

- **Derived** offers come from the sheet itself: a 5E character whose experience earns another
  level is offered `level-up` for as long as that holds. A character imported with 7000
  experience at 1st level gets the offer at once; leveling up (with the action, or by raising the
  class level and filling its choices by hand) ends it, and with experience left for another level
  the next one appears. They are never stored, and can't be dismissed: hiding one for now is your
  app's display choice.
- **Ephemeral** offers are moments: damage that calls for a concentration check, a wound that
  calls for a wound roll. The `applyChanges` that triggers one stores it in the character's
  `followUps`, so it survives a reload and every app sees it, until it is acted on or dismissed.
  One that a state calls for (`becomes`: MÖRK BORG's broken roll at exactly 0 HP) is stored once,
  however often the state comes back, and ends with that state: heal above 0, or die below it,
  and the next `applyChanges` deletes it, with `offers` leaving it out at once. One that an
  event calls for (`on`: each hit's concentration check) stays until run or dismissed.
  An action can offer one too: its `proposedChanges` may hold `{ type: 'offerFollowUp',
  followUp, source?, params? }` (a sorcerer's blood magic after a cast), which stores it when you
  apply them. Pass it on with the rest; there is nothing to show for it until it is stored.

```ts
const result = applyChanges(ruleset, tamsin, [
  { type: 'adjust', field: '5e-srd-5.1:hp.current', by: -12, tags: ['damage', 'damage.fire'] },
]);
result.character.followUps; // stored in the file
// [{ id: 'concentration-1', followUp: '5e-srd-5.1:concentration', params: { damage: 6 }, cause: {…} }]
computeSheet(ruleset, result.character).offers;
// [{
//   id: 'concentration-1',
//   kind: 'ephemeral',
//   followUp: '5e-srd-5.1:concentration',
//   to: 'self',
//   required: true, // the rules call for the save
//   action: { id: '5e-srd-5.1:concentration-check', followUp: 'concentration-1' },
//   params: { damage: 6 }, // the damage taken, after her fire resistance
//   cause: { field: '5e-srd-5.1:hp.current', by: -6, requested: -12, taken: -6, … },
// }]
```

`result.followUps` lists the ones this batch stored, the same way, for a "this just happened"
prompt.

**The engine runs and applies nothing here.** Your app decides what to do with each offer:

- **Run it.** An `action` is ready for `startAction`: pass `action` and `params` straight in, and
  supply any parameters the offer doesn't fix (a Mothership wound roll's damage type). Because
  `action` carries `followUp`, the finished run's `proposedChanges` end with
  `{ type: 'clearFollowUp', id }`, so applying them removes the offer in the same batch. A run
  that fails, or changes you never apply, clear nothing.
- **Apply it.** `changes` are ready for a new `applyChanges` batch (5E: damage at 0 hit points is
  a failed death save), and for an ephemeral offer they already end with the clear. That batch may
  store follow-ups of its own.
- **Make a linked character.** An offer with `create` (a MÖRK BORG companion's sheet) asks for a
  new character for an empty link slot: make the file, run the named creation start on it and
  save the link, which ends the offer
  ([other characters](other-characters.md#linked-sheets)).
- **Dismiss it.** `{ type: 'dismissFollowUp', id }` deletes an ephemeral offer unrun. Only
  ephemeral ones: a derived offer lasts as long as its condition.
- **`required`** marks what the rules mandate (dying, death saves, concentration). It's advice for
  your app (don't let the player skip it); the engine blocks nothing, and a GM can still dismiss
  it.
- Show it first when a person should decide: a GM may rule otherwise. The pack's text keys
  `followUps.<id>.name` and `followUps.<id>.description` (with `followUp`'s local ID, or
  `<contentId>.followUps.<id>.…` for one on content, with `source` naming it) give your dialog its
  words.
- `to` says whose follow-up it is: `self`, or a linked character (`{ link }`, with its ID in
  `character`). Show it to whoever controls that character.

**Apply each attack or effect as its own batch.** Some follow-ups fire once per batch, on the
batch's damage summed: a 5E hit with a Flame Tongue is two changes (slashing and fire) but one
concentration check, and one failed death save at 0 hit points. Two attacks applied in one
batch would get one check between them.

Storing depends only on the batch and the character, so replaying a change list stores the same
follow-ups, and the clears and dismissals your app applied are in the list too.

## Temporary effects

Spells, conditions and other effects from content the character doesn't own live in the
character's `applied` list. **The engine never tracks time**, so your app decides when they start
and end:

```ts
// Bless is cast on Tamsin
applyChanges(ruleset, tamsin, [
  { type: 'applyEffect', id: 'bless-1', source: '5e-srd-5.1:spells.bless' },
]);
// Concentration broke
applyChanges(ruleset, tamsin, [{ type: 'removeEffect', id: 'bless-1' }]);
```

Use `toggleEffect` to suspend an effect without removing it (a condition that comes and goes).
Your app owns rounds and durations: keep that bookkeeping in your own data, or in `extensions`,
keyed by the applied entry's `id`. Some packs track part of it as a field: 5E's
`concentration.active` is set by casting a concentration spell and cleared by a failed
concentration check, and your app clears it when the spell ends otherwise.

## Who may change what

The engine checks changes against the rules, not against your users. Whether a player may edit
another player's character, or a GM may set any value, is your app's call. Check permissions
before calling `applyChanges`.

## Next

- [Building characters](building-characters.md): creation, choices and level-ups.
