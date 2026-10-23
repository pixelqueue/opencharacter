# Building characters

Character creation and levelling up are mostly **choices**: a class, a playbook, skills, a
fighting style, cantrips, a subclass at level 3. The packs declare them, the engine says which
are waiting for an answer and which options are eligible, and your app decides how to ask.

## Three ways to create a character

Every game can be created the same three ways, and the pack says which it supports.
The ruleset lists its **creation starts** in `ruleset.creation`:

```json
"creation": [
  { "id": "classless", "action": "mork-borg-core:create-character", "params": { "classless": true }, "random": true, "pack": "mork-borg-core" },
  { "id": "class", "action": "mork-borg-core:create-character", "random": true, "pack": "mork-borg-core" }
]
```

Name each start with `creation.<id>.name` in its pack's text. For a new character, make the file
with `creating: true`, then offer:

| Mode   | Offer it for          | Run                                                                           |
| ------ | --------------------- | ----------------------------------------------------------------------------- |
| Random | a start with `random` | the start's action, policy `{ dice: auto, choices: auto, allocations: auto }` |
| Guided | every start           | the same, policy `{ dice: pause, choices: pause, allocations: pause }`        |
| Manual | always                | nothing: the player fills in the blank sheet                                  |

```ts
const character = { specVersion: SPEC_VERSION, id: newId(), packs, creating: true };
const start = ruleset.creation[0];
let run = startAction(ruleset, character, {
  action: { id: start.action },
  params: start.params,
  policy: { dice: 'pause', choices: 'pause', allocations: 'pause' }, // guided
});
// Put each pause to the player and continueAction with the answer, as in Rolling dice.
```

A guided run is a wizard: each pause is a question. Besides dice and choices, creation uses
**allocations** (`needs.kind: 'allocate'`): spend a budget across fields (FitD's four action
dots, 5E point buy) or hand out a list of values (5E's standard array, Fate's skill pyramid).
`needs.allocate` lists the fields, and the budget or the values. Each field has its computed
`value` and its `input` value, before effects, so you can show "8 + 7 point buy + 2 racial"; on
a budget it also has its `limit` and `costs`, the cost of each amount from 0, so the points
left are `budget` less the sum of `costs[amount]` (5E's point buy: `[0, 1, 2, 3, 4, 5, 7, 9]`).
Answer with `{ amounts }`, a map of field ID to amount:

```ts
continueAction(ruleset, run, {
  amounts: {
    'fitd-scoundrel:ratings.prowl': 2,
    'fitd-scoundrel:ratings.survey': 1,
    'fitd-scoundrel:ratings.command': 1,
  },
});
```

A creation action can also ask the picks the content it adds brings (5E's skills and fighting
style, a Mothership class's skills, FitD's Veteran), one choice at a time. Such a pause carries
`needs.choice`: the choice's `path`, `owner` and `id`, and its `min`, `max` and `picked` so far,
for "pick 2 of 6". Name the question with the choice's own text,
`<owner>.choices.<id>.prompt`, and the options as you name `listOptions` results. `#done` ends
the whole step, not just this choice: every choice still pending is left for later, so label it
"Skip the rest" (`actions.options.done.pending.name`).

The finished run proposes the changes that build the character, ending with `finishCreation`.
A creation action puts everything it decides on the sheet through those changes: the rolled gear,
the statuses paid for, the loadout taken. Its outcome is only a report of the run: its `data` keys
have no text, and nothing keeps it after the run, so don't look there for anything the player
keeps. Applying the changes is the player's confirmation. `finishCreation` clears `creating`, unless something
is still missing: then the batch fails with `creation-incomplete`, and the result's `issues`
list what's missing (a pending choice as `too-few-picks`). Apply the other changes on their own,
let the player resolve what's listed (often the picks the added class or race brings), and apply
`{ type: 'finishCreation' }` when they're done. A character made by hand finishes the same way.

While `creating` is true, the pack's creation-only rules apply as ordinary rules issues (FitD:
no action above 2; Fate: the skill pyramid), so a manual builder shows them like any other.

## Three kinds of input

- **Numbers the player supplies** (ability scores, rolled hit points): `set` them. On a sheet
  filled in by hand, the engine checks only that the value fits the field (a whole number from 1
  to 30), plus any creation-only constraint the pack has. A pack's creation action may offer
  generation methods (5E's offers 4d6 drop lowest, point buy and the standard array); your app
  can offer others ("my GM said 18").
- **Content choices** (a class, skills, a feat): go through the engine, as below.
- **The player's words** (a name, a look, a background, a rival): text no mode draws. A creation
  action takes them as string `params` (in `ruleset.rules.actions[id].params`, each named by
  `<actionKey>.params.<param>.name`), and the pack's text input fields hold them on the sheet.
  A random start passes none, so it leaves them blank: ask for them before the run and pass them
  as `params`, or show the fields after it. A blank one is a rules issue only when the pack has a
  constraint for it (Fate's high concept). Forged in the Dark is the example: its scoundrel's
  heritage, background, alias, look, friend, rival and vice purveyor, and its crew's reputation,
  lair, hunting grounds, favorite contact and factions, are all params of the creation action,
  and the SRD names no playbook or crew type, so neither is asked unless the table adds its own
  as homebrew.

Input fields, with their types and bounds, are in `ruleset.fields` (`input: true`). The pack's
display hints often give an `input` widget too ([Showing a sheet](showing-a-sheet.md#value-types-and-formats)).

## Starting content

Some content is added, not chosen. In 5E, a class is a copy in the character's `features`, with
its level as state:

```ts
applyChanges(ruleset, character, [
  {
    type: 'addItem',
    entry: {
      id: 'fighter',
      item: '5e-srd-5.1:classes.fighter',
      state: { level: 1, startingClass: true },
    },
  },
]);
```

What to offer here (every class) is a catalog, not a choice; see
[Listing content](packs-and-rulesets.md#listing-content). Other games declare their starting
picks as rules-level choices instead: a new FitD scoundrel has a pending `special-abilities` and `vice`
right away (and an optional `playbook` when the table has its own).

Which content a game adds and which it chooses is the pack's design. An any-game builder works
from `pending` alone, and adds a "add content" screen per content type for the rest.

## Pending choices

After every change, `computeSheet` lists the choices that apply now and still need picks:

```json
"pending": [
  { "path": { "entry": "fighter", "choice": ["fighting-style"] }, "min": 1, "max": 1, "picked": 0 },
  { "path": { "entry": "fighter", "choice": ["skills"] }, "min": 2, "max": 2, "picked": 0 }
]
```

- **`path`** says where the choice lives: on an entry (`entry`), or at the rules level (no
  `entry`), then the choice ID. A nested choice continues the path through the picked option:
  `{ choice: ['playbook', 'homebrew:playbooks.bruiser', 'special-ability'] }` is the
  special ability of a table's own playbook (the Bruiser of `fitd-ash.yaml`), under the playbook
  choice.
- **`min`**, **`max`** and **`picked`** say how many picks it needs and has.
- A choice ID with a slash (`5e-srd-5.1:features.wizard.spellcasting/cantrips`) belongs to
  content granted to the entry rather than to the entry's own item.

The prompt text comes from the choice's owner
([Text and translation](text-and-translation.md#from-an-id-to-a-key)).

Choices can depend on level ("at level 3"), so new ones appear as the character grows. A choice
with `required: false` in the pack is never pending; your app can still offer it.

## Every choice, answered or not

A wizard with Previous and Next needs the answered steps too. `sheet.choices` lists every choice
that applies, in the same order as `pending`, answered or not:

```json
"choices": [
  {
    "path": { "entry": "class", "choice": ["bonus-skills"] },
    "owner": "mothership-1e:classes.marine", "id": "bonus-skills",
    "min": 1, "max": 1, "picks": ["trained"], "open": false
  },
  {
    "path": { "entry": "class", "choice": ["bonus-skills", "trained", "trained"] },
    "owner": "mothership-1e:classes.marine.choices.bonus-skills.options.trained", "id": "trained",
    "min": 2, "max": 2, "picks": ["mothership-1e:skills.computers"], "open": true
  }
]
```

- **`picks`** are the options picked so far; **`open`** is true for the entries that are in
  `pending`.
- **`owner`** and **`id`** name the prompt: `<owner>.choices.<id>.prompt` in the owner's pack
  (`classes.marine.choices.bonus-skills.options.trained.choices.trained.prompt`). A slot has
  `slot: { choice, number }`: its prompt is under `slot.choice`, with `{slot}` filled in.
- Inline options (the Marine's "two Trained skills") and picks that are references only (a
  bard's instruments) are listed here, though `activations` doesn't list them.
- **`preset: true`** marks a choice the content granting it answers (a feat granted for a named
  skill). Its `picks` are the grant's and it is never open. Show it as answered, but don't offer
  to change it: `choose` and `unchoose` on it fail with `preset-choice`.

Show each entry as a step. To change an answer, `unchoose` and `choose` in one batch; the next
sheet lists the new answer's own choices where the old answer's were (after the choices of the
content that asks it).

## Listing options

```ts
const result = listOptions(ruleset, character, { entry: 'fighter', choice: ['fighting-style'] });
// { options: [{ option, eligible, picked, recommended, reasons }, …], min: 1, max: 1 }
```

`listOptions` returns **every** option, including ineligible ones:

- **`eligible`** is false when picking it would cause rules issues, and **`reasons`** lists them.
  They're exactly the issues `applyChanges` would report if the player picked it anyway, so
  "Fighter requires: Strength 13 to multiclass" reads the same in the picker and on the sheet.
- **`picked`** marks options already picked (useful when re-opening a choice to change it).
- **`recommended`** marks the option the pack recommends, if any.

Whether to hide, grey out or allow ineligible options is your call. A strict builder hides them; a
table that bends rules shows them with their reasons.

Options are content IDs (translate with `<id>.name`), inline option IDs (key
`<owner>.choices.<choice>.options.<id>.name`), or plain values. A value may have text under the
same key; without it, name the value yourself (a content ID by its item's name, a field ID by
the field's). A value choice can depend on the character: 5E's Expertise lists every skill and
marks the ones the character isn't proficient in ineligible, and a FitD scoundrel's crew dots
come from the linked crew sheet, so pass the links to `listOptions` too.

Some content choices pick a reference rather than something the character has: a bard's three
instruments are proficiencies, not instruments carried, so they add no actions or effects of
their own.

An unknown path returns `{ errors: [{ code: 'unknown-choice' }] }`.

## Picking

```ts
applyChanges(ruleset, character, [
  { type: 'choose', path: { entry: 'fighter', choice: ['skills'] }, option: 'skill.athletics' },
  { type: 'choose', path: { entry: 'fighter', choice: ['skills'] }, option: 'skill.perception' },
  {
    type: 'choose',
    path: { entry: 'fighter', choice: ['fighting-style'] },
    option: '5e-srd-5.1:fighting-styles.dueling',
  },
]);
```

One `choose` change per pick. Picking an option can make **new choices pending** (a picked
playbook brings its special abilities), so compute the sheet again after each batch and keep
going until `pending` is empty, or the player stops.

`unchoose` removes a pick and every pick nested under it, in the same all-or-nothing change.
Changing a pick is `unchoose` then `choose` in one batch.

## Levelling up

A level-up is ordinary changes in one batch. In 5E it raises a class copy's `level` state:

```ts
applyChanges(ruleset, character, [{ type: 'adjustState', entry: 'fighter', key: 'level', by: 1 }]);
```

Then compute the sheet: at fighter level 3, `martial-archetype` becomes pending. Put the new
pending choices to the player, and apply the level change and the picks together if you want the
whole level-up to be one undo step. 5E's `level-up` action does this for you: after the level and
hit points it asks the choices the new level brings, as a creation action does.

Multiclassing is another class copy (`addItem` with level 1). A multiclass prerequisite the
character doesn't meet comes back as an issue, not an error:

```json
{
  "code": "prerequisite-not-met",
  "id": "5e-srd-5.1:classes.fighter/multiclass",
  "source": { "type": "item", "id": "5e-srd-5.1:classes.fighter", "entry": "fighter" }
}
```

**Legality is checked against the current character only.** If Strength later drops below 13, the
same issue appears, as if the class had been taken illegally. The engine has no history to
consult, and that's on purpose.

## Items and templates

- **Buying or finding gear** is `addItem` with a new instance `id`. Carried content goes to
  `inventory`, the rest to `features`; the engine picks from the content type.
- **Equipping** is `equip`. Effects that only apply while equipped (`when: self.equipped`) follow.
- **Per-copy state** (charges, attunement, a lit Flame Tongue) is `setState`/`adjustState` on the
  entry. The state keys are declared by the content type, the item and its templates.
- **Shaping a copy** (a Fate custom stunt's skill and limit) is `setField` on the entry, for
  item fields its content type marks `perCopy` (`ruleset.contentTypes[type].fields`); `null`
  gives the item's value back. The copy's merged item, with its own values, is its
  `templated` entry.
- **Magic properties** like +1 are **templates** applied to a copy (`applyTemplate`). To offer
  them, list the templates in the ruleset (content of type `template`) whose `appliesTo` matches
  the item; `applyChanges` rejects one that doesn't apply with `template-not-applicable`.
  A template can set fields too (a rarity, a bonus, a Sun Blade's radiant damage). Content can
  also keep templates on items while it's active (a feature lengthening a cantrip's range).
  computeSheet's `templated` lists every such item as merged
  ([Showing a sheet](showing-a-sheet.md#items-with-templates)), so you don't merge them yourself.

## Next

- [Rolling dice](rolling-dice.md).
