# Display hints

Display hints ([`display.schema.json`](../schemas/display.schema.json)) are optional presentation data under `display` in a rules document. They **never affect calculations or saved state**. Apps may ignore them, and hint-only changes need no upgrade script. Homebrew packs can override hints like anything else.

## Groups

A group is a set of keys with an ID, a label, a priority and members.

```yaml
display:
  groups:
    - id: abilities
      priority: 0
    - id: skills
      priority: 1
      members: { type: field, where: "'skill' in item.tags" }
    - id: spellcasting
      priority: 1
      showWhen: 'spellcasting.level > 0'
```

- `label` is a translation key; the default is `groups.<id>.label`.
- A field joins a group by listing the group in its own hints (`fields.<id>.groups`), or by matching the group's `members` query. A query lets homebrew join automatically.
- A field may belong to several groups, such as AC in both `combat` and `summary`.
- `showWhen` is a condition: the Spellcasting group hides itself for a fighter.

### Group kinds

A group's `kind` says what it holds:

| `kind`             | Members                                                                               | `members` query                                                                       |
| ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `fields` (default) | Fields                                                                                | `type: field`, optional (fields may join by their own hints)                          |
| `actions`          | The actions `computeSheet` lists, one member per listing (a weapon attack per weapon) | `type: action`, required; `where` sees `item` as `{ id, tags, entry, source }`        |
| `content`          | The character's copies and picked content of one type, one member per copy or pick    | the content type, required; `where` sees `item` and `self` as a change to copies does |

```yaml
display:
  groups:
    - id: attacks
      kind: actions
      priority: 0
      members: { type: action, where: "'attack' in item.tags" }
    - id: rests
      kind: actions
      priority: 2
      members: { type: action, where: "'rest' in item.tags" }
    - id: spells
      kind: content
      priority: 1
      showWhen: spellcasting.casterLevel > 0 || pactSlots.max > 0
      members: { type: spell }
      sectionBy: item.level
```

- **Actions:** in `where`, `item.id` is the action's qualified ID as listed
  (`5e-srd-5.1:death-save`, `<item id>#<action id>` for an action inline on an item),
  `item.tags` its tags, and `item.entry` and `item.source` the listing's instance ID and source
  content, absent when it has none (`has(item.entry)`). The action's definition (parameters,
  roles) isn't visible: an app reads it from the action. Prefer tags to IDs, so homebrew actions
  join too.
- **Content:** a member is a copy (an entry in `features` or `inventory`) or content active through
  a pick or a grant (a wizard's spells), once per activation, in activation order: computeSheet's
  `activations` whose `scope` isn't `applied`
  ([engine-core.md](engine-core.md#the-activation-list)). `item` is its item (base plus templates)
  and `self` its copy; for picked or granted content, the owning copy with the pick's or grant's
  own state keys over it, as everywhere else, and absent when there is none (a rules-level pick).
  **Templates show with their copy**: a template on a copy, saved or kept (an activation with
  `via: template`), is part of that copy's member, as its `item` already is, and the copy's name
  names it (`{base} +1`). It is never a member of its own, and never in "Other"; its actions and
  choices are listed like any other. Applied entries (`applied`) aren't members unless the query says `from: applied` (below). As in a change aimed at
  copies, the character's fields are visible too. Only the character's own content is listed:
  content the character doesn't have (a shop, a class's spell list) is the app's catalog.
- **Applied entries**: a content group's `members` may say `from: applied`
  (the default is `from: own`, the members above). Its members are then the character's
  `applied` entries whose source is of the type, in file order, inactive and blocked ones
  included; each member is the entry's instance ID. In `where`, `sectionBy` and `sortBy`, `item`
  is the source's item and `self` the entry (`id` and its state, with defaults), as in an
  `applied: { where }` change. The app shows an entry's `active` flag and state from the file,
  and a blocked one by its `immune` issue. A group lists one or the other, so a wizard's spells
  group doesn't pick up an ally's Bless:

  ```yaml
  - id: conditions
    kind: content
    priority: 0
    members: { type: condition, from: applied }
    sortBy: "has(self.by) ? self.by : ''"
  - id: effects-on-you # Bless, Mage Armor cast by someone else
    kind: content
    priority: 1
    members: { type: spell, from: applied }
  ```

- A field hint's `groups` names only `fields` groups.
- `showWhen` and `priority` work as for fields groups. An action or content item in no group
  still exists: an "Other" section keeps homebrew from disappearing. A template on a copy isn't
  such an item: it shows with its copy (above).
- **Empty groups**: `showWhen` says whether a group applies to the character; members
  don't. A pack gives `showWhen` to a group that applies to some characters only (a
  dragonborn's ancestry), true from when the character can gain its members (before the pick is
  made). A group that applies but has no members on this character (no feats yet, nothing
  applied) may be shown empty or collapsed, or hidden, as the app likes; an app shouldn't need
  emptiness to tell relevance. A group of content the character gains by a choice asks
  `hasChoice('<type>')` ([formulas.md](formulas.md#choices-in-display-hints)):
  true while an applicable choice draws from the type, made or pending, so homebrew that brings
  the same choice shows the group without naming its items.

### Sections and order

A content group may also have:

- **`sectionBy`:** a formula giving each member's section key, an integer or a string (spell
  level). Sections are ordered by key: numbers ascending, then strings in code-point order.
  There is one level of sections.
- **Section labels:** `groups.<id>.sections.<key>.name` (`groups.spells.sections.0.name:
  Cantrips`). Optional; without one, the app shows the key.
- **`sortBy`:** a number or string formula. Members are sorted by it (within their section),
  then by instance order. Without it, instance order. Sorting by translated name is the app's
  call.

Both see `item` and `self` as `where` does.

## Priority

- **Priority is a whole number where 0 is highest**, then 1, 2 and so on. There are no negatives, so nothing can jump above 0.
- Group priority is compared among groups. Field priority is compared among fields in the same group. A homebrew field can reorder its own group but can't take over the whole sheet.
- Ties keep their written order, with pack load order as the final tiebreaker, so every app shows the same order.
- Priority orders; it doesn't say what to leave out. Which values a view shows is `visibility` (below); how much a compact view shows within that is the app's call.

## Visibility

`visibility` says how prominently a group, a field or a copy's state key is
shown, with a fixed meaning every app follows:

| Value                 | Meaning                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary`             | Always on the sheet, compact views (a token tooltip, a summary card) included                                                                                           |
| `secondary` (default) | Shown on the play sheet; an app may collapse it                                                                                                                         |
| `background`          | Kept out of play views; shown when editing the sheet. Base scores, maximums, per-level bookkeeping, overrides: values that exist and are edited but aren't read in play |

```yaml
display:
  groups:
    - id: summary
      priority: 0
      visibility: primary
  fields:
    abilities.str.base: { groups: [abilities], priority: 2, visibility: background }
    abilities.str.max: { groups: [abilities], priority: 3, visibility: background }
```

- **Default.** A field's visibility is its own `visibility`; without one, the visibility of the
  group it is shown in; without that, `secondary`. A field in several groups can so differ per
  group: AC is `primary` in `summary` and `secondary` in `combat`. A state key's is its own, else
  `secondary`. Priority never decides visibility.
- **Groups.** A `background` group is kept out of play views with all its members, whatever
  their own; a `primary` group is in compact views, showing its `primary` members. An app
  collapsing a `secondary` group may keep its `primary` members in view.
- **`hidden` is separate.** `hidden: true` means never shown, not even when editing (an
  in-between helper); a hint can't have both (`visibility` with `hidden: true` is a schema
  error). A value the player edits but doesn't read in play is `background`, not `hidden`.
- `showWhen` is independent: an irrelevant field or group isn't shown at any visibility.

## Shown

computeSheet evaluates `hidden`, `showWhen`, `members`, `sectionBy` and `sortBy` for the app
([engine-core.md](engine-core.md#display)), so every app shows the same sheet:

- **A group is shown** when its `showWhen` holds, or it has none. This holds for groups of every
  kind.
- **A fields group's members** are the fields whose hint lists it in `groups` and those its
  `members` query matches. The query's `where` sees `item` as `{ id, type, tags }`, the field's
  tags on the sheet (computed ones included), and the character's fields and copies.
- **A field is shown** when its hint isn't `hidden`, its `showWhen` holds, and it is in no
  fields group (it shows in "Other") or in at least one shown group. A field in a hidden group
  and a shown one shows in the shown one only.
- **An actions group's members** are the listed actions its `where` matches, in list order;
  **a content group's**, the activations or applied entries its query matches, sorted by
  section, then `sortBy`, then instance order ([Sections and order](#sections-and-order)). A
  member whose `sectionBy` fails, or gives neither a whole number nor a string, has no section
  and comes after the sections; one whose `sortBy` fails, or gives neither a number nor a string,
  comes after the sorted ones. An action or content item no group lists is "Other"; one only a
  hidden group lists isn't shown.
- **A state key is shown** when its state hint isn't `hidden` and its `showWhen` holds, seeing
  the copy or pick as `self` and its item as `item`.
- **Failures:** a `showWhen` that fails to evaluate counts as true, so a broken hint never hides
  a value; a `where` that fails matches nothing. Neither is an error on the sheet.
- `showWhen`, `where`, `sectionBy` and `sortBy` are evaluated like field formulas, in the hint's
  or group's pack; `showWhen` with `hasChoice` bound
  ([formulas.md](formulas.md#choices-in-display-hints)).

The result is `groups` (each group's `shown` and its members: `fields`, `actions` or `items`),
`values[<field>].shown`, and each activation's `hiddenState`. Members are listed whether their
group is shown or not. Priority, `visibility` and layout stay the app's: priorities are fixed
numbers in the hints, so sorting groups and fields by them needs no evaluation.

## Field hints

```yaml
display:
  fields:
    abilities.str.score:
      { groups: [abilities], priority: 0, shortLabel: fields.abilities.str.score.short }
    abilities.str.mod: { format: signed }
    helpers.strModRaw: { hidden: true }
```

| Hint                  | Meaning                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `groups`              | Groups the field joins                                                                                                                           |
| `priority`            | Order within each group                                                                                                                          |
| `label`, `shortLabel` | Translation keys overriding `fields.<id>.name` / `fields.<id>.short`                                                                             |
| `format`              | One of the [display formats](../data/display-formats.json): `plain`, `signed` (+3), `percent`, `dice`, `fraction` (1/4); or `{ bands }` (below)  |
| `unit`                | A unit ID: its text is `units.<id>.name` ("feet") and `units.<id>.short` ("ft")                                                                  |
| `input`               | Editor hints: `min`, `max`, `step`, `widget` (`number`, `checkbox`, `dots`, `track`, `text`, `select`). The field's own `min`/`max` still apply. |
| `visibility`          | `primary`, `secondary` or `background` ([Visibility](#visibility)); not with `hidden`                                                            |
| `hidden`              | An in-between helper value that players should never see                                                                                         |
| `showWhen`            | Relevance condition                                                                                                                              |
| `rolls`               | The rolls the field starts ([Rolls](#rolls)), the first its own                                                                                  |
| `with`                | Companion fields shown in the field's tile ([Companions](#companions)); not with `hidden`                                                        |

Hidden fields need no translations.

**Naming a value by a band set**. A field's `format` may be `{ bands: <set> }`, a
result band set the field's pack sees (an unknown one is the load error `unknown-reference`). The
app names the value by the first band of the set whose `when` holds with `roll.total` the value
(`roll.faces` and `roll.kept` empty, every tally 0, and `roll.value` the set's `value` evaluated
so first, when it has one), and shows `bands.<set>.<band>.name` beside or
instead of the number. The engine doesn't evaluate it. Fate's skills are rungs of
its ladder, shown "Great (+4)":

```yaml
# fate-core, rules/skills.yaml
display:
  fields:
    skills.fight: { format: { bands: ladder } }
```

Bands that read anything else (`flags`, `steps`, `params`) don't fit a field's value. State keys
and item fields keep the plain formats.

## Rolls

`rolls` says which rolls a field's tile starts, so an app makes it rollable
without reading formulas. Each is a rules action, local or qualified, with literal values for
some of its parameters:

```yaml
display:
  fields:
    abilities.int.score:
      rolls:
        - { action: ability-check, params: { ability: int } }
        - { action: saving-throw, params: { ability: int } }
    skills.insight: { rolls: [{ action: skill-check, params: { skill: insight } }] }
    stats.strength: { rolls: [{ action: stat-check, params: { stat: stats.strength } }] }
    combat.initiative: { rolls: [{ action: initiative }] }
```

- **Order:** the first roll is the field's own: a tap on the tile starts it. The others are
  offered beside it (a menu), in order: an ability's save beside its check, Fate's four
  actions on a skill.
- **Starting it:** the app calls `startAction` with the roll's `params`. Parameters it doesn't
  give are filled as when the player starts the action from the action list: an optional one (a
  DC) asked or left out, a required one asked (Fate's `action` on `skill-roll`). Situational
  modifiers, participants and checkpoints come through the run as for any action.
- **Values:** a field parameter's value is a field ID, a content parameter's an item ID;
  `loadRuleset` qualifies them, and the action, in the hint's pack (an unknown one is
  `unknown-reference`).
- **Inference:** a field with `rolls` starts those and no others. Without it, an app may still
  infer a roll from an action whose only required parameter is a field the field matches.
- Copies have no `rolls`: a copy's actions (a weapon's attack) are listed per copy by
  `computeSheet` with their `entry`.
- `pnpm validate` checks that the action is a rules action the pack sees, that each parameter
  is declared, and that each value fits its declaration: an enum one of its values, a number
  of the right kind within a literal `min` and `max`, a field one the pack sees that the
  parameter's `where` matches (when the field's tags are static), an item one of the
  parameter's type.

## Companions

`with` names companion fields shown in a field's own tile, so a long sheet
condenses: six tiles reading "13 (+1)" instead of twelve, one reading "0 / 195 lb".

```yaml
display:
  fields:
    abilities.str.score: { with: [{ field: abilities.str.mod, as: modifier }] }
    carrying.weight: { unit: lb, with: [{ field: carrying.capacity, as: max }] }
  types:
    class:
      state:
        level: { with: [{ key: hitDiceSpent, as: detail }] }
```

| Role       | Shown                                  | Types                           |
| ---------- | -------------------------------------- | ------------------------------- |
| `modifier` | After the value, signed: "13 (+1)"     | The field and companion numeric |
| `max`      | After the value, as "x / y": "0 / 195" | The field and companion numeric |
| `detail`   | A small second line under the value    | Any                             |

- **Several:** a list, each role at most once; the tile reads "value / max (modifier)" with
  the detail beneath, whatever the list's order. A track or dots input with a `max` companion
  takes its length from it.
- **The tile** is the field's: its label, groups, priority and visibility. Each companion is
  shown with its own `format` and `unit`, a modifier always signed.
- **Groups:** in a group where the field has a tile, its companions have no tile of their own;
  elsewhere they show as usual. A companion needn't be in the field's groups.
- **`visibility`:** a companion shows in the tile whatever its own, which still applies to its
  own tiles elsewhere. A compact view may drop a `detail`.
- **`showWhen`:** a field not shown leaves its companions to show as usual; a companion not
  shown ([Shown](#shown)) is left out of the tile.
- **`hidden`:** a hidden field has no companions, and a companion isn't hidden.
- **Editing:** an app may split the tile into an input per field.
- **No chains:** a companion has no companions of its own and isn't the field itself. A field
  may be several fields' companion.
- **State keys:** a state hint's `with` names other state keys of the same copy by `key`.
- `loadRuleset` qualifies a field companion; `pnpm validate` checks the rules above and that
  the companion exists.

## Units

`unit` names a unit for a field, a state key or an item field: `unit: ft` shows
5E's speed as "30 ft". Unit IDs are pack-local like other keys, and each needs
`units.<id>.name` and `units.<id>.short` in the default language. A unit only changes display:
converting between units (feet to meters) is the app's call.

## Content-type hints

`display.types.<type>` holds hints for the copies of a content type:

```yaml
display:
  types:
    class:
      state:
        level: { priority: 0 }
        hitDiceSpent: { priority: 1 }
        startingClass: { hidden: true }
      quantity: { hidden: true }
    weapon:
      fields:
        damage: { format: dice }
        weight: { unit: lb }
```

| Key              | Hints                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `state.<key>`    | A field hint without `groups`: `priority` (among the copy's state), `label`, `shortLabel`, `format`, `unit`, `input`, `visibility`, `hidden`, `showWhen`, `with` (naming state keys) |
| `fields.<field>` | `format`, `unit` and `hidden` (off the card; a form still asks it) for an item field                                                                                                 |
| `quantity`       | `hidden`: true when quantity never matters (class features)                                                                                                                          |

- A state key's own `min` and `max` still apply. State keys are named by
  `types.<type>.state.<key>.name` or a state hint's `label`, item fields by
  `types.<type>.fields.<field>.name` ([i18n.md](i18n.md#item-fields)). Their
  enum values have names, and an item's
  card header is its type's **block**, a text template, not a hint
  ([i18n.md](i18n.md#blocks)).
- A character's **headline** ("Level 3 Hill dwarf Wizard") is text too, the pack's `headline`
  template ([i18n.md](i18n.md#headlines)), not a hint: the template names the
  fields and content types it reads.
- A state hint's `showWhen` sees the copy as `self` and its item as `item`, with the
  character's fields; computeSheet evaluates it ([Shown](#shown)).
- The type must be a content type visible from the pack; each state key must be declared by the
  type or by an item of it, and each item field by the type (`pnpm validate`).
- A pack can hint another pack's type; per type, one rules document per pack holds its hints.

### Add or Replace

A content type's copy limit (`copies`; [content.md](content.md#copy-limits)) is
not a hint but tells an app how to offer copies. computeSheet's `copyLimits` gives, per limited
type, `max`, `perItem`, the `count` held and the copies:

- At `count >= max`, the type's Add becomes Replace when `max` is 1 (a `removeItem` then an
  `addItem` reusing the entry's ID, in one batch), and is disabled otherwise.
- `max: 0`: the type is never added as a copy (it is picked in a choice); offer no Add.
- A grant-only item (`grantOnly` in the ruleset's `content`; [content.md](content.md#grant-only-content))
  is never offered for Add: `addItem` of it is `not-addable`.
- An item with `perItem` copies among `entries` is shown as held, not offered again.
