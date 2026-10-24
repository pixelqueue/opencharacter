# Showing a sheet

Everything your app shows about a character comes from `computeSheet`. This page explains its
output, how to lay out a sheet from a pack's display hints, and what to do with competing
options, pending choices and rules issues.

```ts
const sheet = computeSheet(ruleset, character);
```

`computeSheet` **never fails**. Problems in the character file go in `sheet.errors`, and the
sheet is computed without the broken part.

| Output           | What it is                                                                | Typical UI                                     |
| ---------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| `values`         | Every field's value, with its base, a breakdown and whether it's shown    | The sheet itself                               |
| `groups`         | Each display group: whether it's shown, and its members, sorted           | Sections of the sheet                          |
| `effects`        | Every active effect, with its source; stacked-out ones `suppressed: true` | "Active effects" panel, tooltips               |
| `actions`        | Actions available now, with the entry each belongs to                     | Roll buttons ([Rolling dice](rolling-dice.md)) |
| `situational`    | Situational choices offered now (advantage, cover)                        | Toggles next to roll buttons                   |
| `pending`        | Choices that apply and still need picks                                   | "Choose your fighting style" prompts           |
| `offers`         | What the rules offer now: derived (level-up) and stored ephemeral offers  | "Level up", "Concentration check (12 damage)"  |
| `choices`        | Every choice that applies, answered or not, in order                      | A creation wizard's steps                      |
| `competing`      | Fields where several effects compete to set the value                     | A picker on the field                          |
| `issues`         | Rules issues: valid, but the rules object                                 | Warnings                                       |
| `copies`         | Each copy's computed values (an item's quality), by instance ID           | Next to the item in the inventory              |
| `copyNames`      | Copies the player named (`nameFrom`), by instance ID                      | In place of the item's name                    |
| `templated`      | Every item with templates, as merged (a Longsword +1, a longer cantrip)   | Item cards                                     |
| `standardCopies` | The copies every character holds, and whether the file saves each         | The inventory, unsaved items greyed out        |
| `activations`    | Every piece of active content and how it was reached                      | Content groups                                 |
| `copyLimits`     | Per content type, how many copies the character may hold and holds        | Replace instead of Add                         |
| `errors`         | Problems with the file itself (unknown items, wrong types)                | An import warning                              |

The full shape is in
[compute-sheet.schema.json](../../../packages/spec/schemas/engine/compute-sheet.schema.json).
TypeScript types for it, and for every other call's inputs and outputs, are generated from the
schemas: import them from `@opencharacter/spec` (`ComputeSheetOutput`, `FieldValue`, `Change`, …),
or as `spec.*` from the engine.

## Values and breakdowns

Each entry of `values` is `{ value, base, breakdown, shown }`:

```json
"5e-srd-5.1:combat.ac": {
  "value": 17,
  "base": 12,
  "breakdown": [
    { "op": "set", "value": 15, "source": { "type": "item", "id": "5e-srd-5.1:spells.mage-armor" } },
    { "op": "add", "value": 2, "source": { "type": "item", "id": "5e-srd-5.1:armor.shield", "entry": "inv-3" } }
  ],
  "shown": true
}
```

- **`value`** is what to show.
- **`shown`** says whether to show it at all ([below](#laying-out-the-sheet)).
- **`base`** is the value from the field's own formula or input before any effect (10 + Dex
  modifier here).
- **`breakdown`** lists each effect that changed it, in the order applied: `set` replaces,
  `add` adds, `multiply` multiplies, `atLeast` and `atMost` clamp. Each has a `source`: an
  `item` or `template` (with the character's `entry` when it's one of their copies), or the
  `rules`.

That's enough for a "show the work" tooltip: **AC 17 = Mage Armor 15 + Shield 2**. Name
each source with its translated name ([Text and translation](text-and-translation.md)).

A breakdown doesn't explain the base itself (why the base is 12). The field's formula is in
`ruleset.fields[id].formula` if you want to show it.

**A field can have `error` instead of `value`.** That happens when formulas loop through a
specific combination of items (`circular-formula`). Show the field as broken. Everything else on
the sheet is still correct.

### Value types and formats

Values are JSON: numbers, booleans, strings, lists (sets of IDs or tags), dice as text (`1d8`),
or `null`. The field's type is `ruleset.fields[id].type`.

The pack's display hints can name a **format** for a field
([display formats](../../../packages/spec/data/display-formats.json)):

| `format`   | Means                                      |
| ---------- | ------------------------------------------ |
| `plain`    | As is (the default)                        |
| `signed`   | Always show the sign: +3, 0, -1            |
| `percent`  | As a percentage                            |
| `dice`     | As dice notation                           |
| `fraction` | Decimals as fractions: a CR of 0.25 is 1/4 |

A field's format may instead be `{ bands: <set> }`: name the value by a result band set. Find
the set's first band that holds with `roll.total` the value, and show its name
(`bands.<set>.<band>.name`) beside or instead of the number: a Fate skill of 4 is "Great (+4)".
The set is a qualified ID (`fate-core:ladder`) in `ruleset.rules.bands`; the band conditions are
formulas you evaluate with the formula API, as the engine never does.

Where the field is an input, its hint may also have `input: { min, max, step, widget }`, with
`widget` one of `number`, `checkbox`, `dots`, `track`, `text`, `select`. FitD action ratings
are `dots`; FitD stress is a `track`.

## Laying out the sheet

A game-specific app can lay out its sheet by hand and read the fields it needs by ID. An
any-game app uses the pack's **display hints**: optional data that says which fields belong
together and which matter most. They're in the ruleset at `ruleset.rules.display`:

```ts
const { groups, fields: hints, types } = ruleset.rules.display;
// groups: [{ id: 'abilities', kind?, priority: 0, visibility?, members?, showWhen?, label?, pack }, …]
// hints:  { '5e-srd-5.1:abilities.str.mod': { format: 'signed', groups?, priority?, visibility?, rolls?, with?, … }, … }
// types:  { spell: { fields: { … } }, class: { state: { level: { priority: 0 } } }, … }
```

The rules for using them ([Display hints](../../../packages/spec/docs/display-hints.md)):

1. **Groups** are sections of the sheet (`abilities`, `combat`, `skills`). A field belongs to a
   group if its hint lists the group in `groups`, or if it matches the group's `members` query;
   `sheet.groups` lists each fields group's members for you. A field can be in several groups:
   AC is in both `combat` and `summary`.
2. **Priority:** 0 is most important, then 1, 2, … Sort groups by priority. Sort fields within a
   group by their own priority. Ties keep their written order (pack load order last), so every app
   shows the same order.
3. **`visibility`** says what a view shows: `primary` values are on every view, compact ones
   (a token tooltip) included; `secondary` ones (the default) are on the play sheet and may be
   collapsed; `background` ones (base scores, maximums, per-level bookkeeping) stay out of play
   views and show when the player edits the sheet. A field without one takes its group's. How
   much a compact view shows within that is your call.
4. **`hidden: true`** marks in-between helper values. Never show them, not even when editing.
5. **`showWhen`** is a condition: the Spellcasting group hides itself for a fighter. The engine
   evaluates it: hide a group or field whose `shown` is false.
6. **Fields in no group** still exist. An "Other" section at the end keeps homebrew fields from
   disappearing.
7. **`unit`** names a unit: show `units.<id>.short` after the value (30 ft). Converting units
   is your call.
8. **`rolls`** makes a field's tile rollable: each is `{ action, params? }`, a qualified rules
   action and parameter values to pass to `startAction`. Start the first on a tap and offer the
   rest beside it (5E's Intelligence rolls its check, then its save). Ask for or leave out the
   parameters a roll doesn't give (a DC) as when the player starts the action from the action
   list. Without `rolls`, you may still infer a roll from an action whose only required
   parameter is a field.
9. **`with`** puts companion fields in a field's tile, each `{ field, as }`: a `modifier`
   signed after the value ("13 (+1)"), a `max` as "x / y" ("0 / 195"), a `detail` on a small
   second line. In a group where the field has a tile, give its companions none of their own;
   leave out one whose `shown` is false. When editing, you may split the tile into inputs.
   State hints take the same, naming state keys (`{ key, as }`).

### Actions and content

Groups also lay out the rest of the sheet. A group's `kind` is `fields` (the default),
`actions` or `content`:

- **An actions group** holds actions from `sheet.actions`: its `actions` are their indices in
  that list. 5E puts attacks and spells up front, death saves only at 0 HP, and rests on a
  menu; FitD keeps downtime apart.
- **A content group** holds the character's copies of one content type (and content picked
  onto them): its `items` are `{ activation, section? }`, an index in `sheet.activations`, or
  for a group of applied entries `{ entry, activation?, section? }`. They come sorted: by
  section (5E spells by level, cantrips first), then by the group's `sortBy`, then by instance
  order. A section's label is `groups.<id>.sections.<key>.name` if the pack has it, else the
  key.
- **Content-type hints** (`types.<type>`) say how to show a copy: `state.<key>` takes the same
  hints as a field (a class's `level` first, its `startingClass` flag hidden), `fields.<name>`
  a `format`, `unit` or `hidden` (a weapon's damage as dice, its weight in lb), and
  `quantity.hidden` drops the count where it never matters. Each activation's `hiddenState`
  lists the state keys to leave out (hidden, or their `showWhen` false: a mundane sword's
  attunement).

Only content the character has is listed. A shop or a class's spell list is your catalog to
build from the ruleset.

`sheet.activations` lists that content for you: every copy, template, granted and picked piece
of content, and applied content, in instance order, as `{ item, entry?, via, standard?, scope?,
parent?, path?, hiddenState? }`. `via` says how it was reached (`copy`, `template`, `grant`,
`pick`, `applied`), `standard` marks a [standard copy](#standard-copies) (the Fist of every
`orc-2e` character, a ysoki's jaws), `parent` is the index of what granted it or owns the choice
it was picked in, and a pick's `path` is its choice path. Offer Remove only for a `copy` without
`standard`: that is an entry the file saves. A content group's `items` point into this list, so a
Mothership Teamster's skills list shows the two the class grants and the two picked, with no
walking of grants and choices on your side.

### Which groups and fields show

`computeSheet` evaluates every display formula for you (`hidden`, `showWhen`, `members`,
`sectionBy`, `sortBy`), against the character's values, copies and choices
([Display hints](../../../packages/spec/docs/display-hints.md#shown)). You never evaluate one:

```ts
const sheet = computeSheet(ruleset, character);
for (const group of sheet.groups) {
  if (!group.shown) continue;
  if (group.fields) {
    const fields = group.fields.filter((id) => sheet.values[id]?.shown);
    // Sort them by their hints' priority and lay out the section.
  } else if (group.actions) {
    const actions = group.actions.map((i) => sheet.actions[i]);
  } else {
    for (const { activation, entry, section } of group.items ?? []) {
      // Already in order; start a new section when `section` changes.
    }
  }
}
```

- **`sheet.groups`** lists every group in ruleset order as `{ id, shown, fields?, actions?,
  items? }`. `shown` is its `showWhen`. The members are listed whether the group is shown or
  not.
- **`values[id].shown`** is false for a hidden field, a field whose `showWhen` is false, and a
  field whose every group is hidden. A field in no group shows in your "Other" section.
- **Actions and content in no group** (no group's `actions` or `items` names them) go in
  "Other" too; leave out those only hidden groups name.
- **`activations[i].hiddenState`** lists the copy's or pick's state keys not to show.
- A `showWhen` that fails to evaluate counts as shown, so a broken hint never hides a value.
- Sorting groups and fields by `priority` and applying `visibility` stay yours: they're fixed
  numbers and words in the hints, nothing to evaluate.

## Effects

`sheet.effects` lists every active effect with its `source`, `target`, `op` and `value`. Use it
for an "active effects" list or for explaining a roll. Effects excluded by stacking (two Blesses
don't stack in 5E) are listed with `suppressed: true`; show them dimmed or leave them out.

Effects that target **rolls** (Bless's +1d4 on attacks) are listed here but apply only when an
action rolls, and effects on **incoming changes** (fire resistance) apply only when damage is
applied. Neither shows up in `values`.

**Temporary effects** from content the character doesn't own (a spell cast on them, a
condition) live in the character's `applied` list, and your app turns them on and off. The
engine never tracks time: when Bless ends, remove or toggle it
([Changing characters](changing-characters.md#temporary-effects)).

A character can be **immune** to applied content: a monk with Purity of Body can't be poisoned.
The entry stays in the list but has no effect, and `issues` has an `immune` issue whose `data`
names the entry (`{ entry, item }`), so you can show it struck through or offer to remove it.

## Competing options

When several effects try to **set** the same field, the engine doesn't decide which wins. It
lists them, says which one the rules recommend, and applies that one:

```json
"competing": [{
  "field": "5e-srd-5.1:combat.ac",
  "op": "set",
  "options": [
    { "id": "5e-srd-5.1:features.unarmored-defense#0", "value": 14, "source": { … } },
    { "id": "5e-srd-5.1:spells.mage-armor#0", "value": 15, "source": { … } }
  ],
  "recommended": "5e-srd-5.1:spells.mage-armor#0",
  "applied": "5e-srd-5.1:spells.mage-armor#0"
}]
```

Each entry is one competing group: the `set` effects on a field, or a `playerChooses` stacking
group (a choice of morale bonus), with its `op` and `stackKey`. Using the
recommendation without asking is fine. To let the player choose, show the options and pass the
picked option IDs back as the third argument:

```ts
const sheet = computeSheet(ruleset, character, ['5e-srd-5.1:features.unarmored-defense#0']);
```

Each group applies the first of its options (in instance order) that the list names, else its
recommendation.

These picks aren't part of the character file. Store them yourself (in `extensions` if they
should travel with the character), and pass them on every `computeSheet` call. A pick that no
longer names an option falls back to the recommendation.

## Pending choices

`sheet.pending` lists choices that apply now and still need picks: a new fighter's fighting
style and skills, a level-up's new spells. Each one has the choice's `path` and how many picks it
needs (`min`, `max`, `picked`). Show them as prompts; [Building characters](building-characters.md)
covers answering them.

## Offers

`sheet.offers` lists what the rules offer the character now: a level-up its experience has
earned (`kind: 'derived'`, there for as long as that holds) and the moments a change called for
(`kind: 'ephemeral'`, stored in the file until acted on or dismissed, or until the state that
called for it ends: a concentration check, a death save), or a linked character to make (`create`: a MÖRK BORG companion's own sheet).
`required` marks what the rules mandate. Show them beside pending choices; [Changing
characters](changing-characters.md#what-the-rules-call-for-next) covers running and dismissing
them.

## Computed values on copies

`sheet.copies` maps a copy's instance ID to its computed values: a FitD item's quality, a
cohort's quality and scale (`{ "c-thugs": { "quality": 2, "scale": 2 } }`). Show them with the
copy, as you show its state. They are never saved, and a value whose formula failed is missing,
with a `formula-error` in `sheet.errors`. Name each one by
`types.<type>.computed.<name>.name` (`types.cohort.computed.quality.name`), or by
`<item>.computed.<name>.name` when the item declares it; a state key likewise by
`types.<type>.state.<key>.name`. Leave out a value without a name.

## Items with templates

`sheet.templated` lists every item the character has with templates, merged as the rules read
it, so you never merge templates yourself. Each is
`{ entry?, activation?, item, templates, tags, fields }`: first each copy with a saved or kept
template (`entry` its instance ID: a Longsword +1), then each activation of picked or granted
content that content keeps templates on, with `activation` its index in `activations` and no
`entry` (a cantrip a feature reaches 300 feet farther). Templates on content are kept per
activation: a cantrip known through two classes is two activations, and a Warlock feature may
lengthen only the Warlock's. `fields` is each item field as merged. An item or activation that
isn't listed is the ruleset's own. Pass the entry to the item's card
([Showing text](showing-text.md#content-cards)).

## Standard copies

Some games give every character the same items: every FitD scoundrel holds the gear its table tags
`standard`, and one with the Ritual ability holds the ritual it starts with. The pack declares them as standard
copies, so the file doesn't list them until the player changes one. They appear in
`sheet.values`' formulas, in `actions` and in the inventory like any copy, and
`sheet.standardCopies` lists them as `{ entry, item, saved }`. Send changes to them by their
`entry` (`equip homebrew-gear-lantern`, a table's own standard lantern): the engine writes the copy to the file
when it changes, and drops it again once it's back at its defaults. They can't be removed, saved
or not: their activations carry `standard: true`, so offer no Remove for them.

## Rules issues

`sheet.issues` lists everything the game's rules object to: a feat whose prerequisite isn't met,
too many attuned items, a rating past its limit, a condition the character is immune to. Each
issue is `{ code, id?, source?, data? }`.

**Issues don't make a character invalid.** Homebrew tables bend rules on purpose, and legality is
checked against the current character, not its history. Show issues as warnings and let the table
decide. To turn text into issues, see
[Text and translation](text-and-translation.md#errors-and-issues).

## Next

- [Text and translation](text-and-translation.md).
