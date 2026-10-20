# Content

## Content types

Each game defines its own **content types** in data ([`content-type.schema.json`](../schemas/content-type.schema.json)), declared under `contentTypes` in a rules document. Mothership does not inherit 5E's idea of a spell. A type name is an identifier (`weapon`, `fightingStyle`), and the names `template`, `field`, `tag`, `string` and `contentType` are reserved.

A content type's interface has four parts:

| Part    | Declared as                                               | Answers                                                |
| ------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Fields  | `fields: { <name>: valueDecl }`                           | What is it? (damage 1d8, weight 3)                     |
| Effects | `effects` on each item                                    | How does it change the character, and when?            |
| Actions | `actions` on the type (every item gets them) and on items | What rolls can it make?                                |
| State   | `state: { <name>: valueDecl }`                            | What's tracked on _your_ copy? (charges, shots, level) |

A `valueDecl` has `type` (a value type), plus `values` for enums, `of` for `id`/`set`, `members` for an `id` or `set` of `tag` ([rules-and-fields.md](rules-and-fields.md#which-tags-a-field-takes)), `required`, `default`, and `min`/`max`.

Item fields are what an item's author writes, never what changes in play (that is `state`), so
an app can build a custom-item form from them; each has a name and an optional hint in the
pack's text (`types.<type>.fields.<field>.name`; [i18n.md](i18n.md#item-fields)).

An item field's `default` applies when an item doesn't set the field (or, on a copy, when none
of its templates does): `item.<field>` and `copy.fields.<field>` read it as if the item had written it (a string on an `integer`,
`decimal`, `boolean` or `dice` field is a formula, as an item's own value is). An `id` or `set`
item field of a content type or of `field` holds qualified IDs: a value resolves in the item's
pack, a default in the content type's pack, so a stunt's `skill: skills.lore` equals a field
parameter's `params.skill.id`.

Two flags control where copies live:

- `carried: true`: copies go in the character's `inventory`. Otherwise they go in `features`.
- `equippable: true`: copies have the core `equipped` flag (`self.equipped`).

### Copy limits

A content type may say how many copies a character holds:

```yaml
# packs/5e/srd-5.1/rules/content-types.yaml
contentTypes:
  class:
    copies: { perItem: 1 } # each class at most once (multiclassing adds another)
  race:
    copies: { max: 1 } # one race
```

- `max` (an integer ≥ 0): at most this many copies of the type. `perItem` (an integer ≥ 1): at
  most this many copies of any one item of the type. Without `copies`, or without a key, there
  is no limit.
- Each is an integer, which an app reads from the ruleset (`contentTypes.<type>.copies`) without
  evaluating anything, or an integer formula over the character's fields, worked
  out on the computed sheet, so a field content raises lifts the limit (a variant rule allowing a
  second class: `copies: { max: classes.max }`). computeSheet's `copyLimits` gives every limit's
  value; a formula that fails is no limit, with a `formula-error`.
- **What counts:** the character's copies whose item is of the type, in `features` and
  `inventory` alike, [standard copies](#standard-copies) included, whatever their `quantity`
  (ten arrows are one copy). Picked content, granted content, templates and `applied` entries
  are not copies and don't count: a pick is limited by its choice's `pick`.
- `max: 0` says the type is never held as a copy, only by picks (a FitD playbook, picked in a
  rules-level choice).
- Past a limit the sheet has the rules issue `too-many-copies`
  ([engine-core.md](engine-core.md#pending-choices-and-issues)), and strict mode rejects the batch
  as for any issue. computeSheet lists each limited type with its count and copies
  (`copyLimits`), so an app offers Replace instead of Add. A replace is `removeItem` then
  `addItem` in one batch ([engine-core.md](engine-core.md#applychanges)).
- The limit holds always, created or not. A creation-time "needs one" stays a constraint
  (`!character.creating || countCopies(copy.type == 'class') > 0`), as does a limit across
  types (MÖRK BORG's class or companion).
- Content types can't be overridden, so a homebrew or a house rule can't lift a limit; a table
  that allows more runs without strict mode and ignores the issue.

Text: `types.<type>.name`, and optionally a name for each state key and computed value
(`types.<type>.state.<key>.name`, `types.<type>.computed.<name>.name`). A type may also declare
**named texts** (`texts: [material, trigger]`): extra text each item may have,
looked up as `<contentId>.texts.<name>`, none required ([i18n.md](i18n.md#key-conventions)). A type
with `copies` may word its limit as `types.<type>.copies` (optional; `max` and `count` as
arguments).

### Content-type effects and grants

A content type may declare `effects`, `followUps` and `grants` that every item of the type
has, before the item's own:

- `item` and `self` are bound as for the item's effects, and the source is the item, not the
  type.
- An item switches off a type effect by ID with `suppress: [<effect id>]`; the 5E shield
  suppresses armor's `base-ac` and `wearing-armor`.
- Content types can't be overridden by other packs (only items can).

## Content items

A content item ([`content-item.schema.json`](../schemas/content-item.schema.json)) is mechanics only. Its text lives in i18n under `<id>.name` and `<id>.description`.

| Property         | Meaning                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `type`     | Local ID (matching the file path) and content type                                                                                                                               |
| `override`       | Instead of `id`/`type`: patch another pack's item ([packs.md](packs.md#overrides-hiding-and-extends))                                                                            |
| `extends`        | Permanent variant of another item                                                                                                                                                |
| `tags`           | Free-form tags for queries (`martial`, `sword`, `finesse`)                                                                                                                       |
| `fields`         | Values for the type's item fields: literals or formulas. They MUST match the declared types; undeclared names and missing required fields are errors.                            |
| `state`          | Extra per-copy state keys beyond the type's                                                                                                                                      |
| `effects`        | [effects.md](effects.md)                                                                                                                                                         |
| `followUps`      | What the rules call for after a change while the character has the item ([rules-and-fields.md](rules-and-fields.md#follow-ups))                                                  |
| `actions`        | Inline actions, or `{ use: <rules action>, params }`; `scope: applied` offers one on the character the item is applied to                                                        |
| `choices`        | See below                                                                                                                                                                        |
| `grants`         | `{ item, when, scope? }`: other content made active while this item is active (class features at level N); `scope: applied` while it is applied (below); `item` may be a formula |
| `prerequisites`  | `{ id, when }`: conditions for having the item                                                                                                                                   |
| `immuneTo`       | `{ id, items \| query, when?, scope? }`: applied content the character can't be affected by while the item is active (below)                                                     |
| `reapply`        | `{ match?, state }`: what applying the item again does, replacing its type's (below)                                                                                             |
| `appliesTo`      | Templates only                                                                                                                                                                   |
| `removeTags`     | Templates only: tags the copy's item doesn't have ([below](#templates))                                                                                                          |
| `params`         | Templates only: values its item fields read as `params.<name>`, given by the content keeping it ([below](#from-the-keeper))                                                      |
| `keepsTemplates` | Templates kept on the character's copies while the item is active ([below](#kept-templates))                                                                                     |
| `keepsFields`    | Item fields the templates it keeps leave alone ([below](#kept-templates))                                                                                                        |
| `repeatable`     | `true`: exempt from exclusivity groups, so several choices of one can pick it ([below](#exclusive-choices))                                                                      |
| `deprecated`     | `{ since, replacedBy? }`                                                                                                                                                         |

### When content is active

Content is **active** on a character, meaning its effects, grants and choices apply, when it is:

- in `features`;
- in `inventory` (effects usually add `when: self.equipped`);
- picked in a choice, unless the choice says `activate: false` ([below](#picks-that-arent-activated));
- granted by active content whose grant `when` holds (a grant with `scope: applied` by an
  active, unblocked `applied` entry of the content, as applied content: below);
- the source of an active `applied` entry;
- a template applied to an active copy, or kept on it by active content ([below](#kept-templates)); or
- a [standard copy](#standard-copies), which every character holds without the file listing
  it.

Whether an effect applies to the holder or to the character the content is applied to is the effect's `scope` ([effects.md](effects.md#scope)).

**Applied content that includes other content**. A grant (`grants` on a content
type or item) may say `scope`:

| `scope`            | The grant applies while                                           | The granted content's activation   |
| ------------------ | ----------------------------------------------------------------- | ---------------------------------- |
| `holder` (default) | the content is held                                               | holder; `self` the owner copy      |
| `applied`          | the content is the source of an active, unblocked `applied` entry | applied; `self` the granting entry |

The granted content is then applied content too, for as long as the entry: its `scope: applied`
effects, immunities, grants and actions apply, as if it were the source of an entry of its own.
Immunities block it as they would such an entry (reported `immune` with the granting entry);
the entry that grants it stays. A condition that includes another grants it:

```yaml
# packs/orc/2e/content/conditions/grabbed.yaml
grants:
  - { item: conditions.off-guard, scope: applied }
  - { item: conditions.immobilized, scope: applied }
```

**A grant's state**. A grant may say `state`: values the granted content sees as
`self.<key>`, in place of the granting entry's (an applied grant) or the owner copy's (a holder
grant). Each key must be a state key the granted content declares (`unknown-state-key` at load),
and each value is a formula of the key's type, evaluated as the grant's `when` is: an activation
condition reading `self` (the granting entry or copy, as it is), `item` and input fields. A
value that fails leaves the key as it was, with a `formula-error`. So applied content that
includes a valued condition gives the value, and an affliction gives each stage's conditions:

```yaml
# packs/orc/2e/content/afflictions/spider-venom.yaml
grants:
  - { item: conditions.sickened, scope: applied, when: self.stage == 1, state: { value: 1 } }
  - { item: conditions.clumsy, scope: applied, when: self.stage == 2, state: { value: 1 } }
  - { item: conditions.sickened, scope: applied, when: self.stage == 2, state: { value: 2 } }
```

The granted content's `self` keeps the entry's `id` and its other keys; its effects, actions
and nested grants see the values, and nothing is saved.

**A grant's item from a formula**. A grant's `item` may be `{ formula }`: a
string formula evaluated as the grant's `when` is (an activation condition: `self`, `item` and
input fields) to a content ID, qualified in the grant's pack as a literal ID is. An empty string
grants nothing; an ID that names no content grants nothing, with the sheet error `unknown-id`
(data: `id`, `where`). So content grants what the player named, as a spell picked for the day:

```yaml
# packs/orc/2e/content/feats/sorcerer/occult-evolution.yaml
grants:
  - { item: { formula: sorcerer.evolutionSpell }, when: "sorcerer.evolutionSpell != ''" }
```

The same content reached twice (two conditions granting off-guard, or off-guard applied as well)
is two activations, as everywhere; stack keys keep its effects from counting twice where the
game says they don't. `character.applied` stays the file's entries. A `holder` grant of applied
content is not followed, as before.

**Applying content again**. A content type, or an item (replacing its type's),
may say what an `applyEffect` of it does while the character already has it applied:

```yaml
contentTypes:
  condition:
    state:
      value: { type: integer, default: 1, min: 0 }
    reapply: { state: { value: highest } } # frightened 1 on frightened 2 stays frightened 2
# content/conditions/persistent-damage.yaml: one entry per damage type, the higher damage
reapply:
  match: [damageType]
  state: { damage: highest }
```

`state` names, per state key, how the existing entry's value and the new one merge: `highest`,
`lowest`, `add` (numeric keys) or `replace` (the new value). `match` names state keys that must
be equal as well. Every key must be a declared state key of the content (`unknown-state-key` at
load; `add` on a key that isn't a number is `wrong-type`). applyChanges merges instead of adding
an entry ([engine-core.md](engine-core.md#applychanges)).

**Actions of applied content**. An action on content (the type's or the item's,
inline or `use`) has a `scope` too: `holder` (the default) offers it to a character who has the
content active, with its copy as `self`; `applied` offers it for each active, unblocked
`applied` entry whose source is the content, with the entry's ID as its `entry` and the entry
(`id` and its state keys) as `self`. A potion that lets its drinker cast a spell for an hour
keeps the cast on the applied potion, since drinking spent the copy:

```yaml
# packs/5e/srd-5.1/content/magic-items/potion-of-animal-friendship.yaml
actions:
  - use: drink-potion # holder: spends the copy and applies the potion
  - id: animal-friendship
    scope: applied # offered while the potion is applied, at will
    tags: [magic-item, spell]
    participants:
      target: {}
    steps:
      - id: power
        kind: action
        use: item-power
        params: { save: "'wis'", dc: 13, condition: "'conditions.charmed'" }
        participants: { target: participants.target }
```

A shared action in the rules' `actions` has no `scope` (a schema error): the `use` that lists it
does.

An active `applied` entry is **blocked** instead, and not active, when its source matches an
active **immunity**. `immuneTo` on an item lists them:

```yaml
# packs/5e/srd-5.1/content/features/monk/purity-of-body.yaml
immuneTo:
  - { id: poisoned, items: [conditions.poisoned] }
# packs/5e/srd-5.1/content/features/barbarian/mindless-rage.yaml
immuneTo:
  - id: charmed-and-frightened
    items: [conditions.charmed, conditions.frightened]
    when: rage.active
```

- `items` lists content by ID; `query` (`{ type, where }`) matches it by a rule, with the
  candidate as `item`. Exactly one of the two.
- `when`, and the query's `where`, are activation conditions: they read `self`, `item`,
  `character` and raw input values, never derived fields.
- The query's `where` also reads `entry`, the candidate applied entry (`id` and its state keys,
  with their defaults), so it can match by who applied a condition. `character.applied` lists the
  saved entries raw (`{ id, source, active, state }`, blocking not reflected), so a `when` can
  hold only while some content isn't applied:

  ```yaml
  # packs/5e/srd-5.1/content/features/druid/natures-ward.yaml
  immuneTo:
    - id: charmed-and-frightened-by-elementals-and-fey
      query:
        type: condition
        where: >-
          item.id in ['5e-srd-5.1:conditions.charmed', '5e-srd-5.1:conditions.frightened']
            && has(entry.by) && entry.by in ['elemental', 'fey']
  # packs/5e/srd-5.1/content/features/paladin/aura-of-courage.yaml
  immuneTo:
    - id: frightened
      items: [conditions.frightened]
      when: >-
        countList(character.applied,
          x.active && x.source == '5e-srd-5.1:conditions.unconscious') == 0
  ```

- `scope`, as for effects: `holder` (the default) while the character has the item; `applied`
  while the item is the source of an active, unblocked `applied` entry (petrified makes its
  target immune to poison).
- A blocked entry stays in the file and is reported as the rules issue `immune`. An applied
  entry's immunity blocks matching entries before and after it; between entries that block each
  other, the earlier wins, and a blocked entry's immunities block nothing
  ([engine-core.md](engine-core.md#activation)).

### Conditions on computed values

A choice's and a grant's `when`, like every activation condition, read input fields only:
content is activated before any effect computes, so what it adds can't depend on a value it
might change. When a choice matters only for some computed states (a dragonblood's
Draconic Resistance asks for a damage type only for a physical exemplar), make it optional
(`required: false`) and let its options' effects test the computed value; when a grant is
harmless twice (a feat the heritage may already give), grant it unconditionally.

### Per-copy state

The character's copy of an item (an **entry**) has:

- core properties: `id`, `item`, `templates`, `equipped`, `quantity`;
- `state` values for keys declared by the content type, by the item, or by its templates;
- `choices`.

Formulas see the copy as `self`: `self.equipped`, `self.level`, `self.ignited`. State keys MUST NOT reuse core property names.

**A copy named by its state**: a content type or an item may say
`nameFrom: <state key>`, a string state key the copy has (declared by the type or the item). While
the copy's value of the key is a non-empty string (not only spaces), it is the copy's name: apps
show it in place of the item's name, in the sheet's lists and as a choice's copy option (a
faction the GM named, a FitD harm's "Broken leg"). An item's `nameFrom` replaces its type's.
computeSheet gives the names in `copyNames` ([engine-core.md](engine-core.md)). The value is
saved text the player or GM wrote, like a character's name, not pack text, so it has no
translation key. It changes nothing calculated. The validator reports a `nameFrom` that names no
string state key.

```yaml
contentTypes:
  faction:
    nameFrom: label
    state:
      label: { type: string, default: '' }
```

### State formulas

A state key's `default` may be a formula when the key is numeric, boolean or dice, and its `min` and
`max` are always formulas: `shots: { type: integer, min: 0, max: item.magazine, default:
item.magazine }`. For string, enum and id keys a default is always a literal.

- **Roots:** `item`, the copy's item with its templates (closed, as for item field values). No
  `self` and no character functions.
- **Fields:** input fields only (saved value or default), as for activation conditions, so a
  state formula never depends on effects.
- **Types:** the default has the key's type; `min` and `max` are numbers. An integer key's
  decimal bound is compared as is.
- **When:** a formula default is evaluated when the copy is added (`addItem`), or, for a
  template's own keys, when the template is applied (`applyTemplate`), checked against
  the bounds (`out-of-range`), and written into the character file, because saved state must be
  explicit. `setState` and `adjustState` evaluate both bounds for the target copy, with its
  current templates, right before the range check. Any copy whose key has no saved value (an
  unsaved standard copy; a copy written by hand, or one a kept template gives the
  key) has its formula default evaluated when the sheet is computed, the same
  way, with its templates; an unsaved standard copy's are written into the file when a change
  first saves the copy, and a saved copy's file stays as written.

The build and `loadRuleset` check all three like any other formula (`formula-error`).

### Computed values

A content type, an item or a template may declare **computed values**: numbers,
flags or strings worked out for each copy from the character, never saved. A FitD cohort's
quality and scale, or a fine pistol's quality, are computed values.

```yaml
contentTypes:
  cohort:
    fields:
      kind: { type: enum, values: [gang, expert, vehicle], required: true }
    computed:
      quality: { type: integer, formula: "item.kind == 'gang' ? tier : tier + 1" }
      scale: { type: integer, formula: "item.kind == 'gang' ? tier : 0" }
```

- **Declaring:** `computed: { <name>: { type, formula } }`, with `type` `integer`, `decimal`,
  `boolean` or `string`. An item's (and a template's) `computed` adds names or replaces the
  type's by name. A name must not reuse a state key of the copy or a core property (`id`,
  `item`, `templates`, `equipped`, `quantity`); the build reports it.
- **Evaluating:** after every field, for each copy (`features`, then `inventory`, in file order).
  The formula sees `item` (the copy's item with its templates), `self` (the copy, with the
  computed values declared before it), every field, `character`, `links` and the
  character functions, `picksOf` reading the copy's item's choices (a CWN spirit's Effort is
  `max(1, size(picksOf('powers')) - 1)`). It resolves names in the pack that declared it.
- **Reading:** `self.<name>`, in the copy's own actions (including those it reaches through
  `use`, and their `available`) and its follow-ups, and in the copy's later computed values:
  a computed value reads those declared **before** it, in declaration order (the
  type's, then the item's and each template's, a replacement keeping the replaced name's place).
  Later names, and its own, are `unknown-name` there. Field formulas, effects (roll effects
  included), constraints, activation conditions, state formulas and a choice step's candidate
  copies can't read them: there they are `unknown-name` at load, though `self` is open. Since
  they are computed after everything they could feed, and each reads only earlier ones, they
  can't loop. An earlier value that failed is absent (`has(self.<name>)` is false), so a later
  value reading it fails too, with its own `formula-error`.
  The copy aggregates (`countCopies`, `sumCopies`, `maxCopies`, `minCopies`) don't see them.
- **Output:** computeSheet's `copies` maps each copy's instance ID to its computed values. A
  formula that fails, or gives a value of another type, gives no value for that name and a
  `formula-error` in `errors` (data: `entry`, `name`, `cause`).

## Templates

A **template** is content with the built-in type `template` that is applied on top of another item during play, such as a +1 weapon or Flame Tongue.

```yaml
id: magic-items.weapon-plus-one
type: template
appliesTo: { type: weapon }
effects:
  - target: { rolls: [attack, damage], from: self }
    op: add
    value: 1
```

- `appliesTo` is a query, so one template works on every matching item, homebrew included. Applying a template to an item that does not match is a runtime error (`template-not-applicable`).
- `appliesTo` may list several queries: the template applies to an item any of them matches, so one curse fits a ring, a staff and a wand (`appliesTo: [{ type: worn }, { type: staff }, { type: wand }]`). Its item fields are then the template fields and those every listed type declares, and its formulas see `item` typed as the first type's.
- Templates may add `state` (Flame Tongue's `ignited`), effects, actions, choices and grants.
- In a template, formulas see the base item as `base` and the combined item as `item`. Its field
  values also see `prior`: the item as merged before this template, the base item
  and the copy's earlier templates, so templates build on each other (a rune adds its price,
  `price: '(has(prior.price) ? prior.price : 0) + 500'`). For the first template `prior` is the
  base item.
- **Removing tags**. A template may give `removeTags`: the copy's `item.tags` are
  the base item's, then for each template in order its `removeTags` taken away and its `tags`
  added, each once, so a later template may add a removed tag again. Only templates may give it.
- **Template fields**. A template's `fields` may set the **template
  fields** the rules declare (`templateFields: { <name>: valueDecl }`, shared by every
  template), and any field of the content type its `appliesTo` names; anything else is a build
  error, as on items. Its values are read as an item's own are (`integer`, `decimal`, `boolean`
  and `dice` values are formulas over input fields), with `base` bound to the base item, in the
  template's pack.
  - The copy's `item` (and `copy.fields`) is the base item's fields, then each template's in the
    copy's order, a later value replacing an earlier one with the same name: a Sun Blade's
    `damageType: radiant` replaces the longsword's slashing.
  - **A template removes a field with `null`**: the field is absent from the
    copy's `item` and `copy.fields` (`has()` is false; the declaration's `default` doesn't
    apply), unless a later template sets it again. Only templates may give `null`; on any other
    item it fails the schema. Formulas reading such a field should guard it with `has()`, as
    for any field without a default: 5E's Mithral armor gives `strength: null`, so mithral
    plate has no Strength requirement.
  - Every item's `item` has each template field its content type doesn't declare (a type's own
    field wins by name): a template's value, else the declaration's `default`, else it is absent.
    So a plain arrow reads `item.attackBonus` as 0 when the declaration's default is 0.
  - Template fields merge across packs by name. A name declared again must have the same `type`
    (and `of` and `values`), else the load error `template-field-mismatch`; the later
    declaration replaces the earlier.

```yaml
# packs/5e/srd-5.1/rules/magic-items.yaml
templateFields:
  rarity: { type: enum, values: [common, uncommon, rare, very-rare, legendary, artifact] }
  requiresAttunement: { type: boolean, default: false }
  maxCharges: { type: integer, min: 0 }
# packs/5e/srd-5.1/content/magic-items/sun-blade.yaml
fields: { damageType: radiant, rarity: rare, requiresAttunement: true, attackBonus: 2 }
```

- A template's name is a translation with a placeholder, `"{base} +1"` (`{base}` is the base item's translated name), kept in i18n like all text.
- A copy's `templates` apply in order. Applying or removing one is a change like any other (`applyTemplate`, `removeTemplate`), and `listOptions` tells the app which copies a template may apply to.

### Kept templates

A content item may keep templates on the character's copies while it is active (or on content
without a copy, [below](#on-content-without-a-copy)):

```yaml
# packs/orc/2e/content/features/monk/powerful-fist.yaml: the fist deals 1d6
keepsTemplates:
  - template: templates.powerful-fist
    copies: { type: weapon, where: "item.id == 'orc-2e:weapons.fist'" }
```

- `template` names a template (`unknown-reference` at load otherwise). `copies` is a query over
  the copy's base item. One that reads only `item` is resolved by `loadRuleset`, as a standard
  copies query; one that reads the keeper too is an activation condition
  ([below](#from-the-keeper)), and reading anything else (a derived field) is `formula-error`,
  cause `unknown-name`. `when` is an optional activation condition, `params` gives the
  template's params ([below](#from-the-keeper)), and `scope` says whether the item keeps it
  while held (`holder`, the default) or while it is the source of an active, unblocked
  `applied` entry (`applied`), as grants say.
- Every copy (`features` and `inventory`, standard copies included) whose base item the query
  matches keeps the template, after its saved templates, unless the template's `appliesTo`
  doesn't match the item (then it isn't kept; no error). Kept templates follow in instance order
  of the content keeping them; one the copy already has, saved or kept, isn't added again.
- A kept template does everything a saved one does: fields, tags, state keys, effects, grants,
  choices (`<template>/<choice>` in the copy's tree), actions and follow-ups. `self.templates`
  and `copy.templates` list the saved templates, then the kept ones.
- Kept templates are never saved: `removeTemplate` of one only kept is `not-picked`, and
  `applyTemplate` saves it. They are found in the same rounds as standard copies
  ([engine-core.md](engine-core.md#standard-copies)), and computeSheet lists each with `keptBy`
  ([engine-core.md](engine-core.md#the-activation-list)).
- **Fields the kept templates leave alone**. `keepsFields` lists item fields
  the templates an item keeps don't change on the copies it keeps them on: a specific magic
  weapon's Price already counts the runes it comes with, so its runes' `prior.price + 35` doesn't
  apply, while a rune the player etches later (a saved template) still adds its Price. The fields
  are each keeping item's; a template kept by several items leaves the union alone.

```yaml
# packs/orc/2e/content/weapons/specific/sky-hammer.yaml
fields: { price: 70000 }
keepsFields: [price]
keepsTemplates:
  - template: runes.weapon-potency-3
    copies: { type: weapon, where: 'item.id == @weapons.specific.sky-hammer' }
```

#### On content without a copy

A kept template may reach content the character has without a copy of its own: content picked
in a choice or granted, such as a spell known. In place of `copies`, the entry gives `content`,
a query of the same kind, read the same way; an entry has one of the two.
So a feature changes another item's fields, here a cantrip's range:

```yaml
# Potent Spellcasting: a Druid cantrip with a range of 10 feet or more reaches 300 feet farther.
keepsTemplates:
  - template: templates.potent-range
    content:
      {
        type: spell,
        where: 'item.level == 0 && item.range >= 10 && @classes.druid in item.classes',
      }
---
id: templates.potent-range
type: template
appliesTo: { type: spell }
fields: { range: 'prior.range + 300' }
```

- **Which content.** Every holder activation reached by a pick or a grant (at any depth, under
  a copy or the rules) whose item the query matches and the template's `appliesTo` admits keeps
  it, while the keeping item is active and its `when` holds. The templates are kept by item: two
  activations of one spell have the same templates, in instance order of the content keeping
  them, each once. Copies, applied entries and the content applied entries grant are not
  reached.
- **What it changes.** The item only: its fields (with `base`, `prior` and `null` as on a copy)
  and its tags (`tags` and `removeTags`), merged into the content's `item` wherever that
  activation reads it: its effects, grants, choices, prerequisites, actions (their `available`
  and steps, a roll's `roll.item`) and follow-ups. The keeper's `keepsFields` apply too. The
  template isn't an activation of its own, so it is not in `activations`. Queries over items
  (a choice's `from`, a grant's `{ query }`, listOptions' options) still see the base item.
- **Fields and tags only.** With no copy there is no state to hold, nothing for actions or
  choices to belong to. A template kept by `content` may give fields, tags and `removeTags`
  (with `appliesTo`); giving state, computed values, effects, actions, follow-ups, choices,
  grants, immunities, prerequisites or the other copy properties is the load error
  `template-without-copy`.
- **Shown.** computeSheet's `templated` lists each such item as merged, after the copies with
  templates ([engine-core.md](engine-core.md#merged-items)), so an app's card shows the far
  range.

#### From the keeper

A kept template may depend on the content keeping it: which items it goes on, through what the
keeper picked, and how much it gives, through the keeper's values. Eldritch Spear (5E) takes one
known Warlock cantrip and adds 30 feet of range per Warlock level to it:

```yaml
# The invocation, picked under the Warlock: its `cantrip` choice names a cantrip known elsewhere.
id: invocations.eldritch-spear
type: invocation
repeatable: true
choices:
  - { id: cantrip, from: { type: spell, where: 'item.level == 0' }, activate: false }
keepsTemplates:
  - template: templates.eldritch-spear
    content: { type: spell, where: "item.id in picksOf('cantrip')" }
    params: { feet: 30 * self.level }
---
id: templates.eldritch-spear
type: template
appliesTo: { type: spell }
params:
  feet: { type: integer, default: 0 }
fields: { range: 'prior.range + params.feet' }
```

- **Which items.** A `copies` or `content` query whose `where` reads more than `item` is an
  activation condition of the keeper, evaluated for each candidate in the rounds that find kept
  templates: `item` is the candidate's base item, and `self`, `picksOf`, `character`, input
  fields and the character functions are the keeper's, as in its `when`. So a keeper keeps a
  template on what its own choice picked (`item.id in picksOf('cantrip')`), whether or not the
  choice activates the pick. It can't read derived fields, as no activation condition can.
- **How much.** A template declares `params` (`{ <name>: valueDecl }`, templates only), and its
  item field values read them as `params.<name>`. A `keepsTemplates` entry gives them, `params:
  { <name>: <formula> }`, each formula of the param's type evaluated as an activation condition
  with the keeper's roots: its `self` (a picked invocation's is the Warlock copy, so
  `self.level` is the Warlock level), its `item`, `picksOf`, input fields and the character
  functions. A name the template doesn't declare is `formula-error`, cause `unknown-name`, at
  load. A param not given, and every param of a saved template, is its declared `default` (a
  literal), else absent.
- **Free of loops.** A param reads what an activation condition reads, never a derived field,
  so the merged item stays what item field values are: fixed before any effect. A template's
  field that needs a derived value has the keeper's effects target a character field instead.
- **Each keeper its own.** Each activation of the keeper evaluates its own query and params,
  so two Eldritch Spears on two cantrips keep the template on each with its own range. A copy
  or item keeps a template once: when two keepers keep the same template on it, the first in
  activation order gives the params, and its fields apply once. Two features that stack give
  two templates, each building on `prior`.
- **Shown.** The template's fields are merged with the params, so `templated`
  ([engine-core.md](engine-core.md#merged-items)) shows the cantrip's range for this character.

## Queries

A **query** ([`query.schema.json`](../schemas/query.schema.json)) is a link to a set of things written as a rule rather than a list: `{ type, where }`. `type` is a content type name, `field` or `template`. `where` is a condition evaluated with the candidate bound to `item`.

- A query that refers only to `item` is resolved once by `loadRuleset`, after all packs are merged. This is how matching homebrew joins automatically.
- A query that refers to the character (fields, `self`, `character`) is evaluated during `computeSheet` and `listOptions`.

Queries appear in choices (`from`), templates (`appliesTo`), grant values (`{ query }`), immunities (`immuneTo`), standard copies (`standardCopies`) and display groups (`members`).

### Standard copies

The rules, and any content item, may declare `standardCopies`: queries whose matching items
every character holds a copy of. The rules' copies are on every
character; an item's exist while the item is active (the ritual
FitD's Ritual ability starts with). The queries read only `item` and are resolved by `loadRuleset`
(`unknown-name` otherwise), so homebrew with the tag joins and a hidden item drops out.

```yaml
# packs/fitd/scoundrel/content/special-abilities/ritual.yaml
standardCopies:
  - { type: ritual, where: 'item.id == @rituals.ritual' }
```

A standard copy is a copy like any other, in `inventory` for carried types and `features`
otherwise: it has `self.equipped`, `self.quantity`, state, templates and choices, `count`,
`sumCopies` and copy queries see it, and its actions are listed with its entry. Its instance ID
is the item's qualified ID with the colon and dots as hyphens
(`fitd-scoundrel:rituals.ritual` → `fitd-scoundrel-rituals-ritual`); two standard
items that derive one ID are the load error `duplicate-id`. The character file saves a standard
copy only once it differs from its defaults ([characters.md](characters.md#entries)), and it
can't be removed: `removeItem` is `standard-copy`. It counts toward its type's
[copy limit](#copy-limits); rules-level standard copies that alone exceed a type's `max` could
never be valid, and `pnpm validate` reports them.

## Grants and prerequisites

- `grants: [{ item, when }]` makes other content active, such as a class granting its features "at level N" (`when: "self.level >= 3"`). Multiclassing gives each class copy its own `level` state. The total level is a derived field.
- **Waived prerequisites**: a grant may say `waivePrerequisites: true`, and so may
  a choice: the granted or picked item's activation through it reports no `prerequisite-not-met`,
  and `listOptions` gives that choice's options no prerequisite reasons. Only the item's own
  prerequisites are waived; what it grants or picks in turn is checked as usual. A deep orc gets
  Terrain Expertise whether or not it is trained in Survival:
  `grants: [{ item: feats.skill.terrain-expertise, waivePrerequisites: true }]`.
- `prerequisites: [{ id, when }]`: a false prerequisite is the rules issue `prerequisite-not-met`, carrying the qualified owner and prerequisite ID. It is checked against the current character, so a feat whose prerequisite held when it was taken but doesn't now is flagged the same as one taken illegally. `listOptions` reports the same issue as the reason an option is ineligible. Text: `<owner>.prerequisites.<id>`.
- **A choice that requires an option**: a choice may say `requiresOption: true`.
  While it is pending and none of its options is eligible, its owner has the rules issue
  `no-eligible-option` (`id` the owner plus the choice ID, data `{ path }`), and `listOptions`,
  which checks an option as if it were picked, gives that issue as the reason the owner is
  ineligible. 5E's feat instead of an Ability Score Improvement is offered only while some feat
  is open to the character, whatever feats the loaded packs add:

  ```yaml
  id: improvements.feat
  type: improvement
  choices:
    - { id: feat, from: { type: feat }, requiresOption: true }
  ```

## Choices

A **choice** ([`choice.schema.json`](../schemas/choice.schema.json)) is declared on content, on an inline option, or in the rules:

| Property    | Meaning                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | Unique among its owner's choices                                                                                                                          |
| `slots`     | Integers written out: one choice per slot, keyed `<id>-<slot>`, with `slot` bound ([below](#choice-slots))                                                |
| `from`      | Where the options come from: a **query**, `{ items: [refs] }`, `{ values }` (plain values such as skill names; below), or `{ options: [inline options] }` |
| `pick`      | Count (formula) or `{ min, max }`. Default 1.                                                                                                             |
| `when`      | When it applies (`self.level >= 1`). Before that it is neither pending nor active.                                                                        |
| `required`  | Default true. A required choice with too few picks is pending.                                                                                            |
| `recommend` | Formula naming the recommended option                                                                                                                     |
| `effects`   | Applied once per pick, with the option bound to `pick`. Used for value options ("grant proficiency in `pick.value`").                                     |
| `activate`  | Content choices: `false` keeps the picks inactive (below). Default true.                                                                                  |
| `prompt`    | Override for the default key `<owner>.choices.<id>.prompt`                                                                                                |
| `eligible`  | Per option, apart from `from`: a condition with `item` (content) or `value`, and `choice` ([below](#eligibility-and-own-picks))                           |

Picked **content** becomes active: its effects, grants and its own choices apply. Content that
declares state (its type's or its own) keeps it on the pick: it reads
`self.<key>` from the pick's `state` (else the declared default) over the owner's copy, and
`setState` and `adjustState` change it by the pick's `path` and `option`, or `pick: self` in its
own action ([engine-core.md](engine-core.md#applychanges)). An **inline option** (`id`, `tags`, `prerequisites`, `effects`, `grants`, `choices`) behaves the same way. Text: `<owner>.choices.<choice>.options.<id>.name`.

computeSheet lists a character's applicable choices, answered or not, as `choices`, and the
ones still needing picks as `pending` ([engine-core.md](engine-core.md#the-choice-list)).

### Value choices

`from: { values }` offers plain values, strings or numbers:

- `values` is a list written out, or `{ formula }`: a list of strings or numbers evaluated
  against the character, `links` included, so the options can come from a linked sheet. Each
  value is offered once, in the list's order. A formula that fails offers nothing.
- `where` is a condition over each candidate, bound as `value`, with the character's fields,
  `character`, `links`, and the owner's `item` and `self`. It is evaluated with the sheet's
  values, like a query's `where` that reads the character.
- A candidate that fails `where` is `option-not-eligible` in `listOptions`, and a saved pick
  that fails it, or that a formula no longer lists, is the same rules issue. A pick still
  counts and its `effects` still run, so a choice's effects guard what must not apply.
- Text for a value is `<owner>.choices.<choice>.options.<value>.name` when the pack has it;
  otherwise the app names it (a content ID by its item's name, a field ID by the field's).

```yaml
# packs/5e/srd-5.1/content/features/rogue/expertise.yaml
from:
  values: [skill.acrobatics, skill.animal-handling, …, skill.survival, tool.thieves-tools]
  where: >-
    value in proficiencies.skills
      || (value == 'tool.thieves-tools' && '5e-srd-5.1:tools.thieves-tools' in proficiencies.tools)
```

### Picks that aren't activated

A content choice (a query or `items`) may say `activate: false`. Its picks are
saved, counted and checked against the query as usual, and its `effects` run per pick with
`pick.id`, but the picked content isn't active: none of its effects, grants, choices, actions or
follow-ups apply, and `listOptions` checks none of its prerequisites. A pick is then a
reference, such as a tool the character is proficient with but doesn't carry. A hidden pick is
still `content-hidden`.

```yaml
# packs/5e/srd-5.1/content/classes/bard.yaml
- id: instruments
  pick: 3
  from: { type: tool, where: "item.category == 'musical-instrument'" }
  activate: false
  when: self.startingClass
  effects:
    - { target: proficiencies.tools, op: grant, value: { formula: pick.id } }
```

**Nested choices:** an option's own choices become pending as soon as it is picked, and are
asked right after the choice that picked it, before its owner's later choices:
a mastermind rogue's skill comes before the class's free skills, which can then leave it out.
The character stores picks as a tree:

```yaml
choices:
  martial-archetype:
    - option: 5e-srd-5.1:subclasses.champion
      choices:
        additional-fighting-style: []
```

Un-picking an option removes its nested picks in the same all-or-nothing change. Choice paths for changes and `listOptions` alternate choice IDs and picked options ([`change.schema.json#/$defs/choicePath`](../schemas/change.schema.json)).

Nesting depth is limited by the `maxChoiceDepth` safety limit.

### Choice slots

A choice may list `slots`: integers written out, such as the levels a feat is
gained at. It is then **one choice per slot**, in list order, where it is declared:

- **Keys:** each slot is the choice `<id>-<slot>` (`class-feat-2`). Its picks are kept under that
  key, choice paths and `listOptions` use it, and `unique` groups, issues and pending choices see
  each slot as its own choice. A slot's key that equals another choice of the same owner is a
  load error (`duplicate-id`).
- **`slot`:** in every formula of the choice (`when`, `pick`, `recommend`, the query's `where`, a
  value choice's `values` and `where`, `effects`) and of its inline options, `slot` is the slot's
  number (an `int`). `when` is still an activation condition: `slot` is a constant there. In a
  choice without `slots`, `slot` is `unknown-name`. Content a slot picks doesn't see it.
- **Text:** one prompt for every slot, `<owner>.choices.<id>.prompt`, with the slot as the ICU
  argument `{slot}`; options as for any choice, under the declared ID. A pending slot and
  `needs.choice` carry `slot: { choice, number }`, the declared ID and the number.

The list is written, not computed: slots are saved choice keys, so they must not depend on the
sheet.

```yaml
# packs/orc/2e/content/classes/fighter.yaml
- id: class-feat
  slots: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
  unique: feats
  when: level >= slot
  from:
    type: feat
    where: "item.category == 'class' && item.class == 'orc-2e:classes.fighter' && item.level <= slot"
# i18n/en.yaml
classes.fighter.choices.class-feat.prompt: Fighter feat (level {slot})
```

### Exclusive choices

A choice may join an exclusivity group with `unique: <key>`:

- An option picked in one choice of the group is ineligible in the others.
- `listOptions` gives it the reason `already-picked`, and the sheet reports a repeated pick with
  the same issue.
- A choice never excludes its own picks.
- Content with `repeatable: true` is exempt: picked in one choice of the group,
  it stays eligible in the others and isn't `already-picked`. orc-2e's Skill Training
  can be taken in two feat slots.
- The key is pack-qualified like other IDs: a local key (`feats`) is the declaring pack's group,
  and a qualified one (`orc-2e:feats`) joins that pack's, so an extension's or
  homebrew's choices share a dependency's group. The pack must be the declaring pack or one of
  its dependencies (the validator reports another).
- **Per owner**: `uniqueScope: owner` keeps the group to the choices of one owner
  activation: one copy, one pick or grant of the content, one inline option, or the rules. Two
  choices of a feat can't take the same option, while the feat taken again (another activation)
  takes it freely. The default, `character`, is the whole character. `uniqueScope` needs
  `unique`.

5E's fighter and Champion fighting-style choices share `unique: fighting-style`. orc-2e's Skill
Mastery raises one skill to master and _another_ to expert, and may be taken again for the same
skills:

```yaml
choices:
  - { id: to-master, unique: mastery, uniqueScope: owner, from: { values: [skill.acrobatics, …] } }
  - { id: to-expert, unique: mastery, uniqueScope: owner, from: { values: [skill.acrobatics, …] } }
```

### Eligibility and own picks

A choice's `where` (a query that reads the character, or a value choice's), its `eligible`, its
`recommend` and a value choice's `values` formula see `choice`: the choice
itself, `{ path, owner, id, slot?, picks }`, as a choice step over pending choices sees it, plus
`picks`, its own picks (content IDs or values, in saved order). So a choice can offer what the
character doesn't have yet without its own picks ruling themselves out:

```yaml
# packs/5e/srd-5.1/content/classes/wizard.yaml
from:
  values: [skill.arcana, skill.history, …]
  where: '!(value in proficiencies.skills) || value in choice.picks'
```

A content choice (a query or `items`) or a value choice may say `eligible`: a condition each option
must meet, apart from the list `from` gives, with `item` the content option's item (or `value`),
the character's fields, the owner's `item` and `self`, and `choice`. `listOptions` lists what
`from` gives and marks an option failing `eligible` `option-not-eligible`; a saved pick failing it
is the same rules issue. So a query's content-only `where` stays a filter, resolved at load, and
the character's part is eligibility:

```yaml
# packs/5e/srd-5.1/content/backgrounds/acolyte.yaml
from: { type: language, where: "!('secret' in item.tags) && !('monster' in item.tags)" }
eligible: '!(item.id in proficiencies.languages) || item.id in choice.picks'
```

**Cost**. A content-only `where` is resolved once at load, and `eligible` is a
condition on the computed sheet. A `where` that reads the character is checked by
`listOptions` with the option picked, a trial sheet per candidate: cheap for a few dozen options, slow for hundreds (orc-2e's class feats). A
pack with long lists keeps `where` on the item (its level, its traits) and puts the
character's part in `eligible`.

A choice of inline options has no `eligible` (a schema error): its options have prerequisites.
A pick another source also gives (an acolyte cleric's class skill Insight) passes such a
condition, being the choice's own pick; the rules issue is the app's to raise, if the game wants it.

### Reading other choices' picks

Any formula of an owner reads the saved picks of the owner's choices with
[`picksOf('<choice>')`](formulas.md#picks-of-the-owners-choices): a list of content IDs or
values, in saved order. A choice's `recommend`, `eligible` and `where` can depend on a sibling
choice's picks, and a copy's computed values, effects, actions and follow-ups can count its own:

```yaml
# packs/5e/srd-5.2/content/backgrounds/acolyte.yaml: the +1 recommends the best ability the +2
# hasn't taken; `unique` already keeps the two apart.
- id: plus-one
  unique: acolyte-increase
  uniqueScope: owner
  from: { values: [int, wis, cha] }
  recommend: >-
    sortList(filterList(['int', 'wis', 'cha'], !(x in picksOf('plus-two'))),
      -fieldOf('abilities.{ability}.base', x))[0]
```

The siblings are the choices of the same owner: the item's, or an inline option's (here
`two-and-one`'s). Picks are saved input, so two choices may read each other without a loop; each
sees the other's picks, not its recommendation.

### Where picks are kept

Picks for a copy's choices live in its entry's `choices` tree:

- **Bare keys:** the entry's own item uses bare choice IDs.
- **Prefixed keys:** choices declared by its templates or by content it grants are keyed
  `<qualified owner id>/<choice id>`, so they can't collide.
- **Nested picks:** a picked option's own choices nest under the pick, where their owner is
  unambiguous.

Choice paths in changes and `listOptions` use the same keys.
