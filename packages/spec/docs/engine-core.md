# Engine core

How `loadRuleset`, `computeSheet`, `listOptions` and `applyChanges` behave. The calls' inputs and
outputs are in [engine-interface.md](engine-interface.md) and [`../schemas/engine/`](../schemas/engine/).
This chapter fixes the algorithms, so every engine computes the same sheet from the same
character. Parts marked **PROVISIONAL** may change once more games are modeled.

## loadRuleset

Input: pack releases in load order (later packs win). Output: a ruleset, or errors.

1. **Check the packs.**
   - Each pack's `specVersion` must not be newer than the engine's (`spec-version-unsupported`).
   - A pack may appear only once (`duplicate-pack`).
   - Every dependency must be loaded and in range (`missing-dependency`). A dependency may appear
     anywhere in the load order.
   - **Families**: a pack not yet expanded (inline, homebrew) has its rules
     and content expanded with the families it sees (its own and its dependencies' declared
     values, by name, its own first): family keys, and `fields` that name a `viewFields` set.
     Each family's values for formulas are its pack's, then each loaded pack's additions (a
     qualified family name) in load order; `fieldOf` reads an added value's fields in the pack
     that added it, and `fieldId` names them there. The ruleset's `familyOrigins` maps each
     added value to its pack. Problems are `invalid-family`.
2. **Merge the rules.**
   - Fields, content types, situational choices, result bands, actions, rules-level choices and
     constraints are keyed by qualified ID (`pack:id`), so packs never collide. Content type names
     are qualified too, and a type name resolves like any reference.
   - Tags are the union of all packs' tags.
   - **Open enums:** each pack's `extendEnums` values are appended to the enum it names, in
     load order, each once, before anything reads the declarations (an item's own state key's
     or inline action's parameter's once content is resolved, step 3); the ruleset's `enumOrigins`
     maps each added value to its pack. A pack that isn't a dependency of the adding one, an
     address naming no enum, or one not `open`, is `invalid-extension` (data: `pack`, `target`,
     `message`) ([rules-and-fields.md](rules-and-fields.md#open-enums)).
   - Settings merge key by key; a later pack overrides an earlier one, and the override is
     reported in `conflicts`.
   - Display groups and field hints from later packs override earlier ones with the same ID.
   - Creation starts are concatenated in load order into the ruleset's
     `creation`; a later start with the same `id` replaces the earlier one in its place. Each
     `action` is qualified (`unknown-reference` when it names no rules action), and every
     parameter the action requires must be in the start's `params` (`missing-param`, data:
     `param`, `creation`, `pack`). `random` defaults to false.
   - Template fields are keyed by name. A name another pack declared
     earlier must have the same `type`, `of` and `values`, else `template-field-mismatch` (data:
     `field`, `packs`: the earlier pack, then the later); the later declaration replaces the
     earlier. Their `id`, `set` and `list` defaults are qualified in the declaring pack.
   - Link slots are keyed by qualified ID. A slot whose `pack` is loaded too must declare only
     fields of that pack and its dependencies, each with the same type, else
     `link-field-mismatch` (data: `link`, `field`, `pack`).
   - A follow-up's `create` needs `while` and no `on`, `becomes`, `action`,
     `changes` or `to`, else `invalid-create-offer` (data: `followUp`, `pack`). Its `link` is
     qualified like a destination's, and its `start` resolves, once every pack's starts are
     merged, to the ruleset's start with that `id` (and, when qualified, that `pack`), kept as
     `<pack>:<id>` (`unknown-reference` otherwise). When the slot's `pack` is loaded too, the
     start's pack must be it or one of its dependencies, else `link-start-mismatch` (data:
     `link`, `start`, `pack`).
3. **Resolve content.** Every reference in a pack resolves in that pack, then its dependencies,
   nearest first (`unknown-reference` if nothing matches). After loading, every content ID,
   type name, field ID and action ID in the ruleset is qualified. This includes the values of
   `id`, `set` and `list` item fields of a content type or of `field`, and their declared defaults
   (resolved in the content type's pack). A template's values for its base type's fields and
   for template fields resolve in the template's pack.
   - **`extends`:** start from the parent item (itself resolved first; `circular-extends` on a
     loop, `maxExtendsDepth` at most). Then apply the item's own properties: scalars and objects
     key by key, arrays (`tags`, `effects`, `choices`, …) replaced whole.
   - **`override`:** the same merge, applied to the target item in place, in load order. When
     two packs override the same property of the same item, the later one wins and the pair is
     reported in `conflicts`.
   - **`hides`:** hidden items stay in the ruleset, marked `hidden: true`. Queries skip them.
   - **Choice extensions:** after every override, each pack's `extendChoices`, in load order,
     appends its items, values or inline options (qualified in the adding pack, inline options
     kept as that pack's) to the choice it names, each item or value once; the ruleset's
     `optionOrigins` maps each added value and inline option to its pack. An owner pack that
     isn't a dependency of the adding one, a choice the owner doesn't have, or an addition of
     another kind is `invalid-extension`; an owner that isn't loaded content `unknown-reference`;
     an inline option ID the choice has `duplicate-id`
     ([content.md](content.md#adding-options-to-a-dependencys-choices)).
   - **Item fields:** each item's own `fields` (an override's too) must be declared by its
     content type and have the declared shape: no list for an `integer`, `decimal`, `boolean` or
     `dice` field (a string there is a formula, checked in step 5), a string for a `string` or
     `id` field, one of the values for an `enum` (an open enum's merged list), a list for a `set`
     or `list` (no member twice for a `unique` list). After `extends`, every
     `required` field must have a value. Otherwise `invalid-item-field` (data: `item`, `field`,
     `reason`: `missing`, `undeclared` or `wrong-type`, `pack`; `path`:
     `/packs/<i>/content/<j>/fields/<field>`). Templates' fields are checked by the build only.
   - **Destinations:** a `to: { link }` names a slot visible from the pack, qualified at load.
     Changes sent to a link are the linked character's, so their fields and copy types must be
     qualified IDs already (`unknown-reference` otherwise) and are not resolved in the ruleset.
   - **Choice tags:** each static tag of a choice step's `tags` and of an `option` effect's
     `{ choices }` target must be declared by its pack or that pack's dependencies (a tag also
     declares the tags above it), else `unknown-tag` (data: `tag`, `pack`). Other
     tags are checked by the build only.
   - **Tag members:** each tag a declaration's `members` names (a field's, an item field's, a
     state key's, a parameter's) is checked the same way, and the declaration
     gets `tagOptions`: the ruleset's declared tags, with the tags above each, that `members`
     takes, sorted ([rules-and-fields.md](rules-and-fields.md#which-tags-a-field-takes)).
4. **Resolve content-only queries.** A query whose `where` reads only `item` is evaluated once
   against every non-hidden item of its type. Its result (qualified IDs in content order,
   [packs.md](packs.md#dependencies-and-load-order)) is stored in the
   ruleset. Queries that read the character run later. The rules' and items' `standardCopies`
   queries are always content-only (a `where` that reads anything else is a `formula-error`,
   cause `unknown-name`). Two items they match whose derived instance IDs are the same are
   `duplicate-id` (data: `id`, `items`).
5. **Check formulas.** Every formula must parse and type-check as in the build
   ([formulas.md](formulas.md)), resolving field names in its pack and that pack's dependencies.
   Otherwise the error is `formula-error`:
   - `data.cause`: the formula error code (`formula-syntax`, `unknown-name`, `type-mismatch`, …);
   - `data.pack` and `data.formula`;
   - `path`: the document the formula is in (`/packs/<i>/rules` or `/packs/<i>/content/<j>`).

   Formulas are checked once the earlier steps succeed. Loops between formulas
   (`circular-formula`) are left to the build and to `computeSheet`.

The ruleset is plain JSON. Formulas may be kept as text and parsed when first used; the result
must be the same.

## A character's homebrew

A character file may carry its own homebrew ([characters.md](characters.md#homebrew)). Every call
that takes a character (`computeSheet`, `listOptions`, `applyChanges`, `startAction`,
`continueAction` for the paused action's character, `upgrade`) loads it on top of the ruleset it is
given, then works on the result. A character without `homebrew` uses the ruleset as given.

1. **Check what homebrew may not do.** A content item with `override`, or rules with
   `settings`, is `homebrew-not-allowed` (data: `property`). More content items and rules-level
   definitions than `maxHomebrewItems` is `safety-limit-exceeded`.
2. **Load it as a pack.** The section is a pack release with the ID `homebrew`, the character's
   `specVersion`, and every pinned pack the ruleset has as a dependency, in pin order. The
   loadRuleset steps run for the ruleset's packs plus this one: merge, resolve references (in
   the homebrew, then in each pinned pack and its dependencies, in pin order), re-resolve
   content-only queries so homebrew items join them, and check the homebrew's formulas. Its
   formulas written as text count against `maxHomebrewFormulas`.
3. **Errors.** If anything fails, the call returns `homebrew-error` and computes nothing: one
   error per load error, with `data.cause` the load code (`unknown-reference`, `formula-error`,
   `invalid-item-field`, `homebrew-not-allowed`, `safety-limit-exceeded`, …), `data.detail`
   that error's data, and `path` pointing into the character (`/homebrew/content/0`,
   `/homebrew/content/0/fields/twoDots`, `/homebrew/rules`; `/homebrew` when the load error has
   no document). computeSheet returns empty values with the errors;
   the other calls return their failure.

Engines MAY cache the layered ruleset by the homebrew's content and the pins; the result must
be the same as loading it fresh. The ruleset must therefore keep what is needed to load more on
top: the reference engine keeps the pack releases it was loaded from (`sources`).

## The character as engines see it

`computeSheet` and the other calls work on these views of a character.

### Copies and `self`

A **copy** is an entry in `features` or `inventory`. Its view as `self`:

| Property         | Value                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `self.id`        | The entry's `id`                                                                                                          |
| `self.equipped`  | The entry's `equipped`, default `false`                                                                                   |
| `self.quantity`  | The entry's `quantity`, default 1                                                                                         |
| `self.templates` | Qualified IDs of the templates: saved, then kept                                                                          |
| `self.<key>`     | Each state key declared by the content type, the item or its templates: the entry's value, or the declaration's `default` |

A state key with no saved value and no default is absent (`has(self.key)` is false).

In the copy's own actions (their `available` and steps, for actions defined on its content type
or item and the rules actions they `use`) and in its follow-ups, `self` also has the copy's
[computed values](#computed-values) as `self.<name>`. Content picked or granted
on the copy sees the copy's computed values there too, since its `self` is that copy. A roll
effect's `roll.self` doesn't have them.

The copy's picks aren't on `self`: a formula reads its owner's choices with
[`picksOf`](formulas.md#picks-of-the-owners-choices), a copy's item reading the entry's bare
keys, a template or granted content its prefixed ones, picked content those nested under its
pick. A rules action the copy uses reads the copy's.

### Items and `item`

The item a copy holds, as `item`, is the base item merged with the copy's templates:

| Property       | Value                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item.id`      | The base item's qualified ID                                                                                                                                                                                                                                                                                                                                      |
| `item.type`    | The content type's name, unqualified (`weapon`)                                                                                                                                                                                                                                                                                                                   |
| `item.tags`    | The base item's tags, then each template's (less its `removeTags`)                                                                                                                                                                                                                                                                                                |
| `item.<field>` | Each item field, read by its declared type. `integer`, `decimal`, `boolean` and `dice` fields are formulas evaluated with `item` (the base item) and `character` bound. A dice field becomes a dice value. A field the item doesn't set takes its declared `default`, read as if the item had written it in the content type's pack; with no default it is absent |

A template's `fields` are merged over the base item's: each template in
the copy's order replaces the values it gives, a field of the base item's content type or a
template field. Its values are read like an item's own, with `base` bound to the base item
alone, in the template's pack; a `string`, `enum` or `id` value given as `{ formula }` is a
string formula read the same way (a result that isn't a string, or isn't one of an enum's
values, leaves the field as it was). A template's `null` removes the field: it is
absent (no `default` applies) unless a later template sets it again. A template field the
content type doesn't declare and no template sets takes its declaration's `default` (read in the declaring pack), else is absent;
this holds for every item's `item`, with or without templates. Everywhere a copy's `item` is
read (effects, actions, state bounds and defaults, computed values, the candidates of a choice
step over copies and its `steps.<id>.item`, display groups) and in `copy.fields`, the fields are
these merged ones. A copy's own field values ([content.md](content.md#per-copy-fields)) merge
last, after its templates.

In a template's formulas, `item` is the merged item and `base` is the base item alone; its field
values also see `prior`, the item as merged before it, and `params`, its params as its keeper
gave them ([content.md](content.md#from-the-keeper)). A template's `removeTags`
take tags away in template order before its `tags` are added. The templates are
the copy's saved ones, then those content keeps on it ([content.md](content.md#kept-templates)).

Content picked or granted, which has no copy, is merged the same way with the templates content
keeps on its activation ([content.md](content.md#on-content-without-a-copy)): its `item` in its
own effects, grants, choices, actions and follow-ups is that merged item, so two activations of
one item may read different fields. Without such templates it is the base item.

### `character`

`character.creating` is the file's `creating`, false when absent.

`character.inventory` and `character.features` are lists of copies. Each is
`{ id, item, type, equipped, quantity, state }`, with `item` the qualified ID and `type` the
content type name.

`character.applied` is the file's `applied` entries in file order. Each is
`{ id, source, active, state }`: `source` the qualified content ID, `active` the saved flag
(default true), `state` the saved values, each state key the source's content type or item
declares read by its type, with the declaration's `default` when unsaved. It is **raw**: an entry
an immunity blocks is listed as saved, so reading it never depends on the decision it feeds, and
activation conditions may read it.

The copy aggregates (`countCopies`, `sumCopies`, `maxCopies`, `minCopies`) see each copy as the
`copy` root: these keys plus `tags`, `templates` and `fields` (the item fields, as in `item`),
inventory first, then features ([formulas.md](formulas.md#over-copies)).

### Links

The calls that compute the sheet (`computeSheet`, `listOptions`, `applyChanges`, `startAction`)
take optional `links`: by qualified slot ID, a **view** of the character filling the slot,
`{ id, values }`. Link values are inputs, like parameters: the engine
reads them and never computes the other character.

- A slot is **filled** when the character file links it (`links` in the file) or the app passes
  a view for it. The view's `id` is the passed one, else the saved one.
- Formulas read `links.<slot>` ([formulas.md](formulas.md#context-roots)), where `<slot>`
  resolves in the formula's pack, then its dependencies. A filled slot's view is `id` plus each
  declared field, nested at the dots of its field ID (`links.crew.upgrades.mastery`). An empty
  slot is absent: `has(links.crew)` is false.
- A declared field takes the passed value whose field ID, without its pack, is the declared ID:
  an app may pass computeSheet's values as they are (`fitd-crew:tier`) or bare
  IDs. With no such value it reads its `default`; with no default it is absent, so a formula
  guards it with `has()`. A saved link with no view passed reads the defaults.
- A value of the wrong type, or two passed values with the same field ID, is
  `invalid-link-value` in `errors` (data: `link`, `field`, `expected`), and the default is used.
- A saved link or a passed view for a slot no loaded pack declares is `unknown-link` in `errors`;
  the rest computes.
- Link reads add no dependency edges, so they can't form a `circular-formula`.

### Standard copies

The rules and content items may declare `standardCopies` ([content.md](content.md#standard-copies)). The engines see the character with them:

- **Which.** The rules' standard items are the matches of the rules' queries, in load order,
  then declaration order, each query's matches in content order, each item once. An item's are the matches
  of its own queries, held while it has an activation. They are found in rounds: activate with
  the rules' copies; add the copies of every item now active, in activation order, that aren't
  there yet; activate again, until a round adds none (at most `maxChoiceDepth` rounds). A copy
  added in a round stays for that computation. The templates content keeps on copies
  are found in the same rounds: each round also adds, for every active
  `keepsTemplates` entry whose `when` holds, its template on each matching copy that hasn't it,
  or with `content`, on each matching item picked or granted that hasn't it. A query reading
  the keeper and the entry's `params` are evaluated in each round with the keeper's roots
  ([content.md](content.md#from-the-keeper)); a template found again takes the params of its
  first keeper that round. The rounds end when a round adds neither a copy nor a kept template
  and changes no params.
- **Instance ID:** the item's qualified ID with the colon and dots as hyphens.
- **Saved or not.** An entry with a standard copy's ID and item is that copy, saved, in its
  place in the file. An entry with its ID and another item is `duplicate-id` (path: the entry's
  `id`) and is left out. Each unsaved copy is an entry `{ id, item }` after the file's entries of
  its list (`inventory` for carried types, else `features`), in the order above.
- **Formula state defaults**. Every copy's state keys whose `default`
  is a formula and that have no saved value, an unsaved standard copy's and a hand-written or
  saved copy's alike, are evaluated as `addItem` evaluates them (`item` the copy's item with its
  templates, saved and kept; input fields only; in the content type's pack) and held on the
  sheet's entry as `state`, so `self`, `character.inventory` and `copy.state` read them; one that
  fails to evaluate leaves its key absent. A saved value is read as saved, and the file isn't
  changed.

Everything else (activation, `self`, `character.inventory`, `countCopies`, copy queries,
actions, listOptions paths) sees standard copies as entries like any other.

## Activation

Content is **active** when it has an **activation**: a reason to apply its effects, grants and
choices. Each activation records its content, its `self` (a copy, or none), its **owner copy**,
and its scope (`holder` or `applied`):

| Source                                              | `self` and owner                                     | Scope   |
| --------------------------------------------------- | ---------------------------------------------------- | ------- |
| An entry in `features`                              | the entry                                            | holder  |
| An entry in `inventory`                             | the entry                                            | holder  |
| A template on an active inventory or features entry | the entry                                            | holder  |
| A grant of active content, whose `when` holds       | the granting activation's owner                      | holder  |
| A picked content option of an applicable choice¹    | the owner of the choice                              | holder  |
| A picked inline option                              | the owner of the choice                              | holder  |
| An `applied` entry with `active` not `false`        | none (`self` is the applied entry: `id` and `state`) | applied |
| A `scope: applied` grant of applied content²        | none (`self` is the granting entry)                  | applied |
| The rules (always-on effects, rules-level choices)  | none                                                 | holder  |

¹ Unless the choice says `activate: false`: its picks run the choice's
`effects` and are otherwise inactive.

² While its content is active as applied content, unless an immunity blocks it
(below). A grant without `scope` (or `scope: holder`) of applied content isn't followed, and a
`scope: applied` grant of held content isn't either.

An applied entry's `self` is `id` plus its state keys, read as in `character.applied`: declared
keys by their type, with their `default` when unsaved.

Content a holder grant activates that declares state (its type's or its own) reads its keys from
its saved state on the grant's node (the owner copy, or the pick whose tree holds its picks),
else the grant's `state` values, else the declared defaults, over the owner copy, as picked
content reads its pick's ([content.md](content.md#when-content-is-active)). An applied grant's
content sees the granting entry with the grant's `state` values in place.

**Activation conditions** decide what is active: grant `when`, choice `when`, and an
immunity's `when` and query `where`. What activation decides (`countGrants`,
`picksOf(content, choice)`) isn't bound in them. They are
evaluated before any field is computed, so they may read only `self`, `item`, `character` (its
`applied` list included, which is raw), `entry` in an immunity's query, the character functions,
the owner's saved picks (`picksOf(choice)`, `grantedPicksOf`), the rules' (`picksOf('rules',
choice)`) and saved picks (`countPicks`), content by ID (`itemField`, `itemTags`), and the raw values of **input fields** (saved value, or default). Effects
are not applied to those values. A condition that reads a derived field is rejected by the build
(`type-mismatch`). **PROVISIONAL.** This keeps activation free of loops: a class grants features
by `self.level`, never by a computed field.

Activation is found by walking from the copies, the `applied` list and the rules. Each grant and
pick is followed once; the same content reached twice by different paths is two activations.
Grants and choices nest at most `maxChoiceDepth` deep.

**Applied grants**. An applied activation follows its content's grants with
`scope: applied` (the content type's, then the item's) whose `when` holds, an activation
condition with `self` the entry. Each granted content is activated with scope `applied`, the
same entry (its ID is the activation's `entry`) and `self`, and `item` the granted content;
its own `scope: applied` grants are followed in turn. Granted activations come right after
their entry's, depth first, as a copy's grants follow the copy.

**Immunities**. Content and the rules may declare `immuneTo`:
applied content the character can't be affected by, as `items` or a `query`, with an optional
`when`. Immunities are decided during activation, in this order:

1. The holder activations are found first: the rules, then the copies with their templates,
   grants and picks.
2. Each holder activation's immunities with `scope` `holder` (the default; the rules' have no
   scope) whose `when` holds become **active**, in activation order, then the order they are
   written in.
3. Of the `applied` entries with `active` not `false`, one whose source matches an active
   holder immunity is **blocked**. The others are **candidates**. A candidate's immunities are
   its source's immunities with `scope: applied` whose `when` holds, and a candidate **blocks**
   every other applied entry (never itself) whose source one of them matches, whether that
   entry comes before or after it in `applied`.
4. The candidates are decided in rounds until none is undecided. Each round:
   1. Every undecided candidate whose blockers (the candidates that block it) are all blocked,
      or that has none, becomes active.
   2. Only if step 1 made none active: every undecided candidate has an undecided blocker, so
      some of them block each other in a cycle. The earliest undecided candidate (in `applied`
      order) that blocks itself through a chain of undecided candidates becomes active.
   3. Every undecided candidate that an active candidate blocks is blocked.

   Each round decides at least one candidate, so the rounds end, and the result depends only on
   the `applied` order. Once all are decided, the active candidates are activated in `applied`
   order and their immunities become active. A blocked entry is not activated, so none of its
   effects, grants or choices apply, and its immunities block nothing.

5. **Applied grants**. A candidate's immunities (step 3) include those of the
   content its applied grants reach, except grants an active holder immunity blocks. While an
   active entry is activated, each content its applied grants reach is **blocked** when it
   matches an active holder immunity or an immunity of another active candidate, as an entry
   whose source it were would be (the query's `entry` is the granting entry). A blocked grant
   is not activated, nor what it grants; the entry that grants it stays active. It is
   reported `immune` with `data: { entry, item }`: the granting entry and the granted content.

So an applied immunity blocks a matching entry wherever it is in the list, and order matters
only between entries that block each other: two that do are decided for the earlier one, and a
longer cycle for its earliest member, whose blockers in the cycle then don't count against it.
Petrified blocks poisoned whether it comes before or after it; once petrified is removed, the
poisoned entry still in the list applies again (the poison was suspended).

A source **matches** an immunity when it is in `items` (qualified at load; `unknown-reference`
otherwise), or when it is of the query's `type` and the query's `where` holds with `item` bound
to the source's item (hidden or not). `when` and the query's `where` are activation conditions,
evaluated with the immunity's activation bound (`self`, `item`, `character`, `links`), `item`
rebound to the candidate's source in `where`, and `entry` bound there to the candidate entry: `id`
and its state keys, as its `self`. So a query can match by who applied a
condition (`entry.by`), and a `when` can read `character.applied` (an immunity that lapses while
the holder is unconscious). A blocked entry stays in the file; `toggleEffect` and
`removeEffect` work on it as before, and it applies again once the immunity goes away. Each
blocked entry is reported as `immune`, once per matching immunity
([Pending choices and issues](#pending-choices-and-issues)).

**Effects on a set of fields** ([effects.md](effects.md#targets)). An effect
whose target is `{ fields: { where } }` is one instance per field its query matches, in ruleset
field order, each with that field as its target. Everything on this page that says "an effect
on a field" applies to each instance: stacking, competing (option ID `<…>@<field>`),
breakdowns, `effects` and dependencies. A field whose tags are computed is
matched when it is computed: its tags are evaluated first (a failure, an undeclared tag or a
loop is the field's error), and an instance whose `where` doesn't hold for them doesn't exist on
this sheet, so it neither stacks nor appears in `effects`.

**Content type effects and grants.** Wherever an item is active, its content type's effects
(minus those the item `suppress`es) and grants apply first, then the item's own. Their
competing-option keys are `<item id>#type.<effect id or index>`.

**Choice keys.** An activation reads its choices' picks from its tree. The tree's own item (the
entry's item, or a picked option) uses bare choice IDs. A template or granted content in the
same tree uses `<qualified owner id>/<choice id>`, and its choice paths use that key.

## computeSheet

### Effects

The **effect instances** are every effect of every activation whose scope matches the
activation's scope (`holder` effects for holder activations, `applied` effects for applied ones),
plus each choice's `effects` once per pick (with `pick` bound). An instance's source is
`{ type: item | template | rules, id, entry? }`.

- Situational effects are not part of the sheet; they apply only when an action rolls.
- Effects targeting rolls are listed in `effects`, but they apply only when an action rolls.
- Effects targeting incoming changes apply only in `applyChanges`.

### Field values

Each field's value is computed on demand and remembered. To compute field F:

1. **Base value.**
   - An input field takes its saved value, or its `default`.
   - A derived field with a `formula` evaluates it.
   - Any other field starts at its `default`, or empty: `[]` for sets, `0` for numbers, `false`
     for booleans, `''` for strings, enums and IDs, and a dice value with no dice (written `0`)
     for dice. No field type starts as `null`.
2. **Grants:** for a set field, each active `grant` instance whose `when` holds adds its members.
   - An `item` grant adds a qualified ID.
   - A `tag` grant adds a tag.
   - A `field` grant adds a qualified field ID.
   - A `query` grant adds every match.
   - A `formula` grant adds the formula's value.
   - The result is sorted and has no duplicates.
3. **Set:**
   - **Collect.** Gather the active `set` instances on F whose `when` holds.
   - **Stack.** Apply [stacking](#stacking).
   - **Pick one.** If several remain, they are **competing options**:
     - **Option IDs:** each option's ID is `<source id>#<n>`, the effect's index in its
       content's `effects` list (or `#<effect id>` when the effect has one). Two copies of
       the same content share their option IDs, so a pick can't tell them apart; the earlier
       copy applies. **PROVISIONAL.**
     - **Recommended:** the option chosen by the field's `recommend`, or else by
       `settings.competing.recommend`. `highest` and `lowest` compare values, with ties going
       to the earlier instance. `first` and `last` use instance order.
     - **Applied:** the first option, in instance order, whose ID is in the input's
       `competing` list, otherwise the recommended one. IDs that name no option are ignored.
     - **Reported:** one `competing` entry `{ field, op: set, options, recommended, applied }`.
   - The applied value replaces the base.
4. **Add:** the sum of the active `add` instances' values, after stacking.
5. **Multiply:** multiply by each active `multiply` instance's value, in instance order. For an
   `integer` field, round after each multiplication with the effect's `rounding`, else the
   field's `rounding`, else `settings.rounding` (default `floor`).
6. **atLeast / atMost:** raise to the highest active `atLeast`, then lower to the lowest active
   `atMost`.
7. **Round and clamp.**
   - An `integer` field's decimal result that doesn't come from `multiply` (a formula, or an
     `add` with a decimal value) is rounded with the field's `rounding`, or else
     `settings.rounding` (default `floor`).
   - A derived value outside the field's `min`/`max` is clamped.
   - For an input field, `min`/`max` check only the saved value. A saved value outside them is
     reported in `errors` (`out-of-range`) and clamped before effects apply. Effects may then
     take the final value past them.

**Instance order** is the order activations are found:

1. The rules.
2. `features`, then `inventory`, in file order. Each copy is followed by its templates, its
   grants and its picks, depth first.
3. `applied`.

Within one content item, effects keep their written order.

An effect's `when` and `value` may read other fields. A field reached again while it is still
being computed is a **loop**: every field in the loop gets `error: circular-formula`. A field
that reads a field with an error gets that error too. Every other field still calculates.

`breakdown` lists, in application order, each instance that changed the value:
`{ op, value, source }`.

`tags` lists the field's tags on this sheet: its written tags, then those its
`{ formula }` entries give ([rules-and-fields.md](rules-and-fields.md#tags-from-a-formula)), each
once: the tags effects on sets of fields, field parameters and allocate steps match it by. When
its computed tags fail (the field then has `error`), it lists the written ones. A field with no
tags has none. An app lists a field parameter's options before a roll by these tags.

`name` is the value of the field's `nameFrom` string field
([rules-and-fields.md](rules-and-fields.md#fields-the-player-names)) when it is a non-empty
string (one of only spaces counts as empty), as saved; absent otherwise. The field's text
formats it as `{name}`.

### Stacking

Instances on the same target with the same `stackKey` form a group. The reserved key `source`
means the instance's source content ID, so two instances from the same item share it. Each
group is reduced by the policy for its key (`settings.stacking.keys`, else
`settings.stacking.default`, else `addAll`):

- **`addAll`:** all count.
- **`highestOnly`:** only the highest value counts, ties going to the earlier instance. Dice
  values compare by average (a die averages (sides + 1) / 2, a Fate die 0); a number is its
  own average.
- **`lowestOnly`:** the reverse of `highestOnly`.
- **`playerChooses`:** the instances become competing options, as for `set`, with the highest
  recommended. The group is its own `competing` entry, with its `op` and `stackKey` (the key as
  written, so `source` for the reserved key), and is picked independently of the field's other
  groups. Only `computeSheet` reads picks: incoming-change effects, and the sheets that
  `listOptions`, `applyChanges` and actions compute, keep the recommended option.

Instances that don't count are listed in `effects` with `suppressed: true`. Instances without a
`stackKey` always count.

### Pending choices and issues

For each activation's choices, and the rules-level choices:

- **Not applicable:** the choice's `when` is false.
  - Its picks are reported as `choice-not-applicable`.
  - Its picked options are not activated.
- **Applicable:** the choice's `pick` gives `min` and `max` (an exact count sets both).
  - With fewer picks than `min` (and `required` not `false`), the choice is **pending**.
  - With more than `max`, the issue is `too-many-picks`.
- **The order of `pending`** is a pre-order walk of the activations:
  the rules-level choices first, then each activation's own choices in declaration order, each
  followed at once by the choices of the content and inline options picked in it (in the same
  order, recursively), then those of the other activations it reaches (its templates and
  grants), in activation order. A starting rogue is asked its four skills before the Expertise
  the class grants, and its racket's skill right after the racket, before the class's later
  choices. A choice step over pending choices, and `finishCreation`'s `too-few-picks` issues,
  follow the same order.
- **`pending`** is the open entries of [the choice list](#the-choice-list), in
  the same order, each as `{ path, min, max, picked, slot }`, `picked` the number of picks.
- **Choice issue IDs:** `choice-not-applicable`, `too-many-picks` and `option-not-eligible`
  carry `id: <owner>/<choice id>`, where the owner is the content ID of the item that declares
  the choice (or `rules`), and `source` is the owner's activation.
- **Slots**: a slotted choice is one choice per slot, each keyed `<id>-<slot>`
  and gathered in list order where the choice is declared, with `slot` bound in its formulas
  ([content.md](content.md#choice-slots)). Each is pending, applicable or not, and reported on its
  own, under its key. A pending slot carries `slot: { choice, number }`, the declared ID (whose
  prompt names it) and the slot's number. computeSheet, `listOptions` and `applyChanges`'
  `choose` and `unchoose` see the same choices.

**Rules issues**, all reported in `issues`:

- `prerequisite-not-met`, for each prerequisite of active content (and of picked inline
  options) that is false, unless the grant or choice that activated it waives them
  (`waivePrerequisites`).
  - `id` is the qualified owner plus the prerequisite ID (`5e-srd-5.1:classes.fighter/multiclass`).
  - `source` is the activation.
- `no-eligible-option`, for each pending choice of active content that says
  `requiresOption` and has no eligible option not yet picked, as `listOptions` lists them.
  - `id` is the qualified owner plus the choice ID; `data` is `{ path }`.
  - `source` is the owner's activation. listOptions' trial sheet for an option reports it with
    the option's prerequisites.
- `constraint-failed`, for each rules constraint whose `check` is false; a constraint with
  `copies` for each copy it fails on, in copy order, with `data.entry`.
  - `id` is the constraint's qualified ID.
  - `data` is its evaluated `data`.
- `option-not-eligible`, for a picked option that no longer matches its choice's query, and
  for a picked value that fails its choice's `where` or that its formula no longer lists,
  and for a pick that fails its choice's `eligible`.
- `content-hidden` covers hidden content picked in a choice with `activate: false` too; it
  belongs to the choice's owner.
- `content-hidden`, for owned or picked hidden content.
- `immune`, for each blocked `applied` entry and each active immunity its source matches: the
  holder's, then the active candidates' in `applied` order ([Activation](#activation)).
  - `id` is the immunity's qualified owner plus its ID
    (`5e-srd-5.1:features.monk.purity-of-body/poisoned`); for the rules', its pack plus its ID
    (`5e-srd-5.1:listed`).
  - `source` is the immunity's activation (for the rules', `{ type: rules, id }` with the same
    `id`).
  - `data` is `{ entry, item }`: the applied entry's ID and its source.

**More issues**:

- `already-picked`, for each pick of an option already picked earlier (in activation order) in
  another choice with the same `unique` group, unless the option is `repeatable` content. `data`
  names the earlier choice's path. A local key is the declaring pack's group and a qualified one
  that pack's; with `uniqueScope: owner`, only the choices of the same owner activation share the
  group.
- `out-of-limits`, for a field whose final value is outside its `limits`. `id` is the field, and
  `data` is `{ field, limit, value, bound }`.
- `too-many-copies`, for a content type whose copies exceed its `copies.max`, and for an item
  whose copies exceed its type's `copies.perItem` ([Copy limits](#copy-limits)).

**Order.** Each issue belongs to an activation: a prerequisite or hidden content to the
activation of its content, a choice issue (`choice-not-applicable`, `too-many-picks`,
`option-not-eligible`, `already-picked`) to the activation that owns the choice, an `immune`
issue to the immunity's activation, and a constraint or a rules immunity to the rules, which come
first. A `too-many-copies` issue belongs to the rules too; a `no-eligible-option` issue to the
activation that owns the choice. Issues are listed by activation
order, then by kind: `prerequisite-not-met`, `no-eligible-option`, `constraint-failed`,
`too-many-copies`,
`choice-not-applicable`, `too-many-picks`, `option-not-eligible`, `already-picked`,
`content-hidden`, `immune`. Issues of the same activation and kind keep the order their
prerequisites, constraints, choices and picks are written in; `too-many-copies` issues go by type
in ruleset order, a type's `max` issue before its items' in the order of their first copy;
`immune` issues follow the `applied` order, then the order the immunities are written in.
`out-of-limits` issues belong to no activation and come last, in field order.

### Actions

An action is available when its `available` formula (if any) is true. An available action with
`listed: false` (on the action, or on the `use` that names it) is left out of `actions`: only
`startAction` and other actions' `action` steps run it. Two kinds of action are listed in
`actions`:

- **Content actions:** the actions of each activation that has an item: its content type's
  actions, then the item's own, then its templates'. A holder activation lists those with
  `scope: holder` (the default); an applied entry's activation those with `scope: applied`,
  with the entry's ID as `entry` and no `source`. Its actions run with `item`
  the source's item and `self` the entry (`id` and its state keys, as its effects see it,
  without computed values). Content an entry grants with `scope: applied`
  lists its `scope: applied` actions with the entry's ID as `entry` and the content's
  qualified ID as `source`.
  - An activation with an owning copy is listed with the copy's `entry`. An action of content
    picked in a choice or granted to the copy, rather than the copy's own item, also carries
    `source`: that content's qualified ID. Several picks can then use the same
    shared action.
  - An activation with no owning copy (the rules' picks and everything nested in them) is
    listed with `source` and no `entry`. Its actions run with `item` bound to
    the content and no `self`, as for rules-level activations' effects.
  - Each action is listed once per `(action, entry, source)`, so the same content reached by
    two paths with no copy is listed once.
- **Rules actions:** shared actions that no content type or item `use`s, listed without an
  `entry`.

An item action written as `use` is listed under the used action's qualified ID. An action
defined inline on an item is listed as `<item id>#<action id>`.

**Order:** content actions come first, in activation order, each activation's actions in the
order above. Rules actions follow, in definition order: packs in load order, then each pack's rules
files in path order.

### Computed values

After every field, each copy's computed values ([content.md](content.md#computed-values))
are worked out, copies in instance order (`features`, then `inventory`, in file order), each
copy's names in declaration order: the content type's, then the item's and each template's, a
later declaration replacing an earlier one with the same name in its place.

- A formula resolves names in the pack that declared it (an override's in the overriding pack)
  and sees `item` and `self` as the copy's effects do, every field (fields never read computed
  values, so they are all computed first), `character`, `links` and the character functions,
  `picksOf` reading the copy's item's choices. `self` has the copy's computed values declared before this one, each as
  worked out; one that failed is absent. A replacement keeps the replaced name's place, so the
  values after it read the replacement, and it reads only what comes before the name.
- An `integer` value must be an int, a `decimal` value a number (an int becomes a decimal), a
  `boolean` value a bool and a `string` value a string.
- A formula that fails, or gives a value of another type, gives no value and the error
  `formula-error` (data: `entry`, the copy's instance ID; `name`; `cause`, the formula error
  code or `type-mismatch`).

`copies` maps each copy that has any computed values to `{ <name>: value }`. The same values
are `self.<name>` in the copy's actions and follow-ups ([Copies and `self`](#copies-and-self));
an engine may compute them on demand, with the same result.

`copyNames` maps each copy whose item or content type has `nameFrom`
([content.md](content.md#per-copy-state)) to the value of that state key, when it is a
non-empty string (not only spaces); an item's `nameFrom` replaces its type's. Copies without one
are left out.

### Merged items

`templated` lists every item the character has with templates, as the rules read it, so an app
shows a Longsword +1's bonus or a cantrip's longer range without merging templates itself. Each
is `{ entry?, activation?, item, templates, tags, fields }`:

- First each copy with a saved or kept template or own field values
  ([content.md](content.md#per-copy-fields)), in instance order, with `entry` its instance ID; then each activation of content picked or granted that content keeps templates on
  ([content.md](content.md#on-content-without-a-copy)), in activation order, with `activation`
  its index in [`activations`](#the-activation-list) and no `entry`. The same item reached twice
  (a spell known through two classes) is listed per activation, each with its own templates.
  Content without templates isn't listed: its item is the ruleset's.
- `item` is the base item's qualified ID and `templates` the templates in the order they apply
  (saved, then kept).
- `tags` is the merged `item.tags`, and `fields` each item field as the merged `item` reads it
  ([Items and `item`](#items-and-item)): a template's `null` leaves the field out, a default
  fills in, and a dice field is its canonical dice text.

### The activation list

`activations` lists every content activation ([Activation](#activation)), in instance order:
the rules-level picks, then each copy with its templates, grants and picks,
depth first, then the active applied entries with their applied grants. Each is
`{ item, entry?, via, scope?, parent?, keptBy?, path? }`:

- `item`: the content's qualified ID (the base item; a template is its own activation).
- `entry`: the owner copy's instance ID, or for applied content the applied entry's ID; absent
  for content picked or granted at the rules level.
- `via`: how it was reached: `copy` (a `features` or `inventory` entry), `template` (on a copy),
  `grant` (granted by active content, its `when` holding), `pick` (a content option of an
  applicable choice that activates its picks) or `applied` (an `applied` entry, or a
  `scope: applied` grant of one).
- `scope`: `applied` for applied activations; absent for holder ones.
- `parent`: the index in this list of the activation that granted it, owns the choice it was
  picked in, or owns the template: the nearest listed one, so content picked in an inline
  option's choice has the inline option's owner. Absent for copies, applied entries and content
  picked or granted at the rules level.
- `keptBy`: for a template content keeps on the copy, the index of the
  activation that keeps it (the first, when several do). Absent for a saved template.
- `path`: for a pick, the choice path of the pick (`change.schema.json#/$defs/choicePath`), the
  picked option last, as `pending` and change paths name it. For a holder grant whose node is a
  pick (content granted by picked content or an inline option), that pick's path, which names
  the grant's saved state ([applyChanges](#applychanges)).

Inline options, the rules and applied entries an immunity blocks (which aren't activated) aren't
listed, nor are the picks of a choice with `activate: false`. A content group's `from: own`
members are the holder activations whose item is of the group's type
([display-hints.md](display-hints.md)); a template's activation is part of its copy's member.

### The choice list

`choices` lists every applicable choice ([Pending choices and issues](#pending-choices-and-issues)),
answered or not, in the order of `pending`: the rules-level choices, then each
activation's own choices in declaration order, each followed by the choices of what it picked,
then those of the activations it grants.
Inline options' choices and choices with `activate: false` are listed like any other, and a
slotted choice is one entry per applicable slot. A choice that isn't applicable isn't listed
(its picks are `choice-not-applicable` issues). Each is
`{ path, owner, id, slot?, type?, min, max?, picks, open }`:

- `path`: the choice path (`change.schema.json#/$defs/choicePath`), as `choose`, `unchoose` and
  `listOptions` take it.
- `owner` and `id`: as a choice step's `needs.choice` ([engine-actions.md](engine-actions.md)):
  the qualified key root of the choice's owner (the content ID, `<pack>:rules` for a rules-level
  choice, and for a choice nested in an inline option the owner's root plus
  `.choices.<choice>.options.<option>`) and the choice's ID (a slot's own, `<id>-<slot>`). The
  prompt is `<owner>.choices.<id>.prompt`, under `slot.choice` for a slot.
- `slot`: for a slot, `{ choice, number }`, as in `pending`.
- `type`: the qualified content type the choice draws from: a query's `type`, or
  the one type every item of a written `items` list shares. Absent for inline options, values
  and items of several types. Display hints' `hasChoice` reads it
  ([formulas.md](formulas.md#functions)).
- `min` and `max`: the evaluated pick counts, as `listOptions` gives them (`max` absent when
  unbounded; a count that fails to evaluate leaves the default, 1).
- `picks`: the picked options, in saved order: content IDs, inline option IDs or values. For a
  choice a grant presets, the grant's.
- `open`: whether the choice is pending: `required` not `false` and fewer picks than `min`; a
  preset choice never is.
- `preset`: `true` when a grant presets the choice
  ([content.md](content.md#when-content-is-active)); `choose` and `unchoose` on it are
  `preset-choice`.

The entries with `open: true` are `pending`. Each content pick in
[the activation list](#the-activation-list) has a listed choice's path plus the option; inline
options and `activate: false` picks are listed only here. A creation wizard shows each entry as a
step, answered or open, and swaps an answer with `unchoose` then `choose` in one batch.

### Copy limits

For each content type with `copies` ([content.md](content.md#copy-limits)), in
ruleset order (packs in load order, then declaration order), after activation:

- **The copies** are the character's `features` and `inventory` entries whose item is of the
  type, in instance order, standard copies included, whatever their `quantity`. An entry whose
  item is unknown counts for no type.
- **`copyLimits`** has one entry per type: `{ type, max, perItem, count, entries }`, with `type`
  qualified, `max` and `perItem` as declared or, for a formula, its value on the
  computed sheet (absent when not declared, or when the formula fails: a `formula-error` with
  `where: '<type> copies <key>'`), `count` the number of copies
  and `entries` each copy as `{ entry, item }`.
- **`too-many-copies`** when `count` exceeds `max`: `id` the qualified type, `source`
  `{ type: rules, id }` with the same `id`, and `data: { type, max, count, entries, limit }`,
  `entries` the copies' instance IDs and `limit` equal to `max`.
- **`too-many-copies`** for each item of the type with more than `perItem` copies, in the order
  of its first copy: the same, with `data: { type, item, perItem, count, entries, limit }`,
  `count` and `entries` the item's and `limit` equal to `perItem`.

An app's rule: at `count >= max`, Add becomes Replace (when `max` is 1) or is disabled; an item
with `perItem` copies is shown as held. A replace is one applyChanges batch, `removeItem` then
`addItem` reusing the instance ID ([applyChanges](#applychanges)).

### Display

After the values, computeSheet evaluates the display hints
([display-hints.md](display-hints.md#shown)):

- **`groups`** lists every display group in ruleset order (a later pack's group in place of an
  earlier one with the same ID) as `{ id, shown, fields?, actions?, items? }`. `shown` is the
  group's `showWhen`, true without one. Members are listed shown or not:
  - a fields group's `fields`, in ruleset field order: the fields whose hint names the group,
    and those its `members` query matches, `where` seeing `item` as `{ id, type, tags }` with
    the field's sheet tags;
  - an actions group's `actions`: the index in `actions` of each listing its `where` matches,
    seeing `item` as `{ id, tags, entry?, source? }`, in list order;
  - a content group's `items`: for `from: own`, `{ activation, section? }` for each holder
    activation of the group's type in `activations` (templates aren't members); for
    `from: applied`, `{ entry, activation?, section?, hiddenState? }` for each applied entry of
    the type in file order, `activation` when it is listed (active and not blocked) and
    `hiddenState` when it isn't. `where`, `sectionBy` and `sortBy` see the activation's `item`
    and `self`, or for an unlisted entry its source's item and the entry. Members are sorted by
    `section`, then the `sortBy` key, then instance order; numbers come before strings, and a
    member without a key after both.
- **`values[F].shown`**: F's hint isn't `hidden`, its `showWhen` holds, and F is a member of no
  fields group or of at least one shown one.
- **`activations[i].hiddenState`**: the state keys its content declares (with a copy's
  templates) whose type's state hint is `hidden` or has a `showWhen` that doesn't hold, seeing
  the activation's `item` and `self`; absent when there are none. Templates have none: their
  keys are their copy's.
- Every formula is evaluated in the hint's or group's pack, as a field formula is; a
  `showWhen` with `hasChoice` bound. A `showWhen` that fails to evaluate counts as true; a `where` that fails
  matches nothing; a `sectionBy` or `sortBy` that fails, or gives a value of another kind (a
  whole number or a string; a number or a string), gives no key. None adds to `errors`.

### Offers

`offers` lists what the rules offer the character now: its stored ephemeral
follow-ups, then its derived offers whose condition holds. See [the offer list](#the-offer-list).

### Situational choices

`situational` lists the qualified IDs of the situational choices offered now: those whose
`available` holds, or that have none, in definition order (packs in load order, then each pack's
rules files in path order). A condition that fails to evaluate counts as false. The list holds
choices for rolls and for incoming changes alike; an app offers a choice for a
change when its `incoming` matches the change.

### Errors

`computeSheet` never fails. Problems with the character file are listed in an `errors` array
(the codes are runtime error codes), and the sheet is computed without the offending part:

- An entry whose item is unknown (`unknown-id`) is skipped.
- A saved value for an unknown or derived field is ignored (`unknown-field`, `not-input-field`).
- A wrong-typed input value is ignored, using the default (`wrong-type`).
- Pinned versions that differ from the ruleset's are reported (`pack-version-mismatch`).
- A link to an undeclared slot is ignored (`unknown-link`); a linked value of the wrong type
  reads the field's default (`invalid-link-value`).
- A computed value whose formula fails is left out (`formula-error`).
- An entry with a standard copy's ID and another item is skipped (`duplicate-id`); the standard copy is unsaved.

## listOptions

Input: a choice path. Output: every option of the choice, in a stable order:

- listed `items` and `values` in written order, a `values` formula's list in its order (each
  value once);
- inline options in written order;
- query matches in content order ([packs.md](packs.md#dependencies-and-load-order)): the load
  order, then each pack's content order.

For each option:

- **`eligible`**: the option has no reasons.
- **`reasons`**: the rules issues picking it would add, including `already-picked` when the option
  is picked in another choice of the same `unique` group (unless the content is `repeatable`). These
  are the option content's prerequisites (evaluated with the option active, as if picked; none for a
  choice with `activate: false`), with `no-eligible-option` for a choice of its own that requires an
  option and would have none, and, for a query whose `where` reads the character or a value choice's
  `where` (`value` bound to the candidate), `option-not-eligible` when the option fails it, or fails
  the choice's `eligible`. These formulas see `choice`, the choice with its own `picks`
  ([content.md](content.md#eligibility-and-own-picks)).
- **`picked`**: whether it is currently picked.
- **`recommended`**: whether the choice's `recommend` names it; a choice without `recommend`
  marks none (there is no default).

`min` and `max` are the choice's evaluated pick counts (`max` is absent when unbounded). An
unknown path is the error `unknown-choice`, returned as `{ errors }`.

## applyChanges

The changes apply in order to a copy of the character. If one fails, the whole batch is rejected
with its error (`path: /changes/<index>`) and the character is unchanged. After the last change,
the sheet is computed: its rules issues are returned, and in strict mode any issue rejects the
batch (`rules-issue`, with the issues attached).

**Replacing a copy** is one batch, `removeItem` then `addItem`, which may reuse
the removed entry's instance ID:

```yaml
- { type: removeItem, entry: class }
- { type: addItem, entry: { id: class, item: mothership-1e:classes.teamster } }
```

The changes apply in order, so the ID is free again for the `addItem`, and the sheet (and strict
mode) sees only the result: a type at its `copies.max` takes the swap without `too-many-copies`.
The old copy's picks, state and templates go with it.

### What the batch did

applyChanges binds **`batch`** in the formulas it evaluates: a change aimed at
copies or applied entries (`where`, `by`, `value`) and an `applyEffect`'s state value given as
`{ formula }`. `batch.adjustments` lists the `adjustments` entries of the batch's earlier
changes on this character that change a field, in order, each `{ field, by, requested, reason,
clamped, tags }`, as an `on` follow-up's `change` has them (`requested` 0 and `clamped` false
when absent). An action passes on a formula that reads `batch` (a state value as `{ formula }`),
so it learns what its own earlier changes did to the target: 5E's wound holds the hit points
the target lost to the batch's damage, after its resistances and temporary hit points.

An `applyEffect` state value `{ formula }` is evaluated with `item` the source's item, the
character's fields and `batch`, in the source's content type's pack; the value is then checked
as any state value is, and the change as applied (the result's `changes`) carries it, as an
adjust carries its rolled faces. The engine stays a reducer: the value depends only on the batch
and the character. An app applies an action's changes for one character as one batch.

applyChanges also takes an optional dice function, outside the JSON shape, as `startAction`
does; only incoming-change effects with dice use it ([below](#dice-on-incoming-changes)). A
successful result returns `changes`: the batch as applied, with the faces it rolled written in.

| Change                          | Runtime checks (error code)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Effect                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set`                           | field exists (`unknown-field`), is input (`not-input-field`), value type (`wrong-type`), within `min`/`max` (`out-of-range`); set members are declared tags or existing IDs (`unknown-id`)                                                                                                                                                                                                                                                                                                           | Stores the value                                                                                                                                         |
| `adjust`                        | as `set`, numeric; its `situational` choices known (`unknown-id`), typed (`wrong-type`), and each selected one offered with a matching `incoming` (`situational-unavailable`)                                                                                                                                                                                                                                                                                                                        | Routed (below)                                                                                                                                           |
| `addItem`                       | instance ID unused (`duplicate-id`); item exists (`unknown-id`); templates are templates and apply (`template-not-applicable`); `equipped` only if equippable (`not-equippable`); state keys declared (`unknown-state-key`) and typed (`wrong-type`); own `fields` as `setField` checks them; a formula default within the key's `min`/`max` (`out-of-range`); each pick, at any depth, names a choice of the copy (`unknown-choice`) and one of its options (`invalid-option`), as a `choose` would | Adds the entry to `inventory` (carried types) or `features`                                                                                              |
| `removeItem`                    | entry exists (`not-owned`); not a standard copy (`standard-copy`)                                                                                                                                                                                                                                                                                                                                                                                                                                    | Removes it with its picks                                                                                                                                |
| `equip`                         | entry in inventory (`not-owned`), equippable (`not-equippable`)                                                                                                                                                                                                                                                                                                                                                                                                                                      | Sets `equipped`                                                                                                                                          |
| `setState`, `adjustState`       | entry exists (a copy, or an applied entry by its ID; a pick by `path` and `option`; with `grant`, a holder grant of that content active on the copy or pick, `not-granted`), key declared (for an applied entry, by its source; for a pick or grant, by its content), type, numeric for adjust, within the declaration's `min`/`max` (`out-of-range`), evaluated for the copy with `item` bound ([content.md](content.md#state-formulas))                                                            | Stores the value                                                                                                                                         |
| `setField`                      | entry exists (`not-owned`); the item field `key` declared `perCopy` by its content type (`not-per-copy`); value type (`wrong-type`); `id` and `set` members exist (`unknown-id`)                                                                                                                                                                                                                                                                                                                     | Stores the copy's own value in its `fields`; `null` removes it ([content.md](content.md#per-copy-fields))                                                |
| `setQuantity`, `adjustQuantity` | entry exists (`not-owned`); an integer (`wrong-type`); the new quantity not below 0 (`out-of-range`)                                                                                                                                                                                                                                                                                                                                                                                                 | Sets `quantity`, or adds `by` to it (default 1). A copy at 0 stays                                                                                       |
| `applyTemplate`                 | entry exists; template is a template (`unknown-id`) whose `appliesTo` matches the item (`template-not-applicable`); not already applied (`duplicate-id`)                                                                                                                                                                                                                                                                                                                                             | Appends it                                                                                                                                               |
| `removeTemplate`                | applied (`not-picked`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Removes it and its state values                                                                                                                          |
| `applyEffect`                   | ID unused when an entry is added (`duplicate-id`; without one, generated: below), source is content and not a template (`unknown-id`), state keys declared (`unknown-state-key`), typed (`wrong-type`) and within their `min`/`max` (`out-of-range`)                                                                                                                                                                                                                                                 | Adds an `applied` entry, or merges into one (`reapply`, below)                                                                                           |
| `removeEffect`, `toggleEffect`  | entry exists (`not-owned`), or by query (below)                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Removes it, or sets `active`                                                                                                                             |
| `choose`                        | the path leads to a choice (`unknown-choice`) no grant presets (`preset-choice`); the option is one of its options (`invalid-option`; a `values` formula is evaluated on the sheet before the change) and not already picked (`duplicate-id`)                                                                                                                                                                                                                                                        | Appends the pick                                                                                                                                         |
| `unchoose`                      | the path leads to a choice (`unknown-choice`) no grant presets (`preset-choice`); the option is picked (`not-picked`). Without `option`: nothing                                                                                                                                                                                                                                                                                                                                                     | Removes the pick and its nested picks; without `option`, every pick and their nested picks (none to remove is no change). The choice keeps an empty list |
| `setExtension`                  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Stores or (with `null`) removes the namespace's data                                                                                                     |
| `finishCreation`                | the character, with the batch's earlier changes applied, has no rules issues and no pending choices (`creation-incomplete`; its `issues`, pending choices as `too-few-picks`, are also the failed result's `issues`)                                                                                                                                                                                                                                                                                 | Clears `creating`. Nothing on a character not being created                                                                                              |
| `setHomebrew`                   | the new homebrew loads (`homebrew-error`, paths into the change: `/changes/<index>/homebrew/…`); the rest of the file names no `homebrew:` content or field it lacks (`unknown-id`)                                                                                                                                                                                                                                                                                                                  | Replaces the homebrew, or removes it with `null`                                                                                                         |
| `dismissFollowUp`               | a follow-up with the `id` is stored (`unknown-follow-up`)                                                                                                                                                                                                                                                                                                                                                                                                                                            | Deletes it, required or not ([Follow-ups](#follow-ups))                                                                                                  |
| `clearFollowUp`                 | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Deletes the stored follow-up with the `id`; none is no change                                                                                            |
| `offerFollowUp`                 | a loaded pack declares the follow-up (`unknown-follow-up`)                                                                                                                                                                                                                                                                                                                                                                                                                                           | Stores it as an ephemeral offer after the batch, when the character has it                                                                               |

Eligibility (prerequisites, pick counts) is never an error. It shows up as rules issues.

**`setHomebrew`** loads the new homebrew on the ruleset as every call does
([above](#a-characters-homebrew)), and later changes in the batch use it. Then every `homebrew:`
ID the rest of the file names must still exist: entries' `item` and `templates`, applied
entries' `source`, picked options at any depth, the owner part of prefixed choice keys, members
of saved sets, and `values` keys. To delete a custom item in use, the batch removes its uses
first. A batch whose **first** change is `setHomebrew` doesn't load the character's current
homebrew, so an app can repair one that no longer loads (after an upgrade, say).

**Standard copies**. A change to an unsaved standard copy writes it to the
file first, as `{ id, item }` appended to its list, with its formula state defaults as the
sheet evaluated them (`state`), then applies as usual: `equip`, `setState`,
`adjustState`, `setQuantity`, `adjustQuantity`, `applyTemplate`, `removeTemplate`, and
`choose` or `unchoose` with the copy's `entry` in the path. A query by `copies` matches unsaved
copies too. `removeItem` on a standard copy, saved or not, is `standard-copy`; `addItem` and
`applyEffect` with a standard copy's ID are `duplicate-id`. After the last change, a saved
standard copy back at its defaults (not equipped, quantity 1, no templates or picks, every saved
state value its key's default) is removed from the file.

**Immunity** is never an error either. `applyEffect` of a source the
character is immune to succeeds: the entry is added, blocked, and the result reports `immune`,
so strict mode rejects the batch (`rules-issue`). A change that gains an immunity while a
matching entry is applied (a monk reaching level 10 while poisoned) reports the same issue, so
the app can remove the entry.

**Applying content again**. An `applyEffect` whose source declares `reapply`
(the item's, else its content type's; [content.md](content.md#when-content-is-active)) looks for
an `applied` entry with the same source, `active` not `false` (a blocked entry counts: the
content is on the character, only suspended), and the same value for each `match` key (the new
state's values with their defaults, against the existing entry's). If there is one, the first in
file order, no entry is added: each key in `state` of that entry becomes the higher of the two
(`highest`; dice compare by average, as in stacking), the lower (`lowest`), their sum (`add`) or
the new value (`replace`). A key the new state doesn't give takes its default; one with neither
value is left as it is. Other keys keep the existing entry's values. The result is checked as a
`setState` would be (`wrong-type`, `out-of-range`), and the change adds `{ applied: [<the
entry's ID>] }` to `adjustments`. An `id` the change gives is not used, nor checked. Without a
match, the entry is added as usual. Replaying the batch gives the same result, since the merge
depends only on the character and the change.

**Changes aimed at copies**. `setState`, `adjustState`, `setField`,
`setQuantity`, `adjustQuantity`, `equip` and `removeItem` may give `copies: { type, where }`
(and optionally `limit`) instead of `entry`:

- The query is resolved against this character at the point the change applies in the batch,
  so earlier changes are visible. Matches are the copies of the content type `type`
  (qualified), inventory first, then features, each in file order, whose `where` holds with
  `item` (the copy's item with its templates) and `self` (the copy) bound. With `limit`, only
  the first that many are changed.
- `by` and `value` are formulas, evaluated per match with the same binding. Names in these
  formulas resolve in the content type's pack.
- The change is then applied to each match as if it named that `entry`, with the same checks.
- An unknown `type` is `unknown-reference`. No match is not an error: `adjustments` gets
  `{ copies: [] }`. Every such change adds `{ copies: [<matched instance IDs>] }` to
  `adjustments`, in order.

**Applied entries**. `applyEffect` may leave out `id`: the entry gets
`<source local id, dots as hyphens>-<n>` (`conditions.poisoned` gives `conditions-poisoned-1`),
the smallest `n` ≥ 1 that no copy, applied entry or earlier change in the batch uses. The
character receiving the change picks it, so an action needs no knowledge of a target's file, and
replaying the batch on the same character gives the same ID. `removeEffect`, `toggleEffect`,
`setState` and `adjustState` may give `applied: { where, limit? }` instead of `id` (or `entry`):

- The query is resolved against this character at the point the change applies in the batch.
  Matches are its `applied` entries, in file order, whose `where` holds with `item` the
  source's item and `self` the entry (`id` and its state, each key the source declares read by
  its type, with its `default` when unsaved, as on the entry's own effects). With `limit` (a
  literal integer ≥ 1), only the first that many are changed.
- `by` and `value` are formulas, evaluated per match with the same binding. Names in these
  formulas resolve in the source's pack.
- The change is then applied to each match as if it named that entry, with the same checks.
- No match is not an error. Every such change adds `{ applied: [<matched instance IDs>] }` to
  `adjustments`, in order.

`setState` and `adjustState` may also name one applied entry by its instance ID in `entry` (a
copy's ID is looked up first). The keys, types and bounds are those the source's content type
and item declare.

**A pick's state**. `setState` and `adjustState` may name a pick with `path` (as
`choose`'s) and `option` instead of `entry`: a pick that isn't there is `not-picked`; the keys,
types and bounds are those the picked content's type and item declare. A value equal to the
declared default is dropped from the pick (an empty `state` with it). `picks: { where, limit? }`
names every pick, in file order (each copy's tree, then the rules-level tree, depth first),
whose picked content declares the change's `key` and whose `where` holds with `item` the picked
item and `self` its state; `by` and `value` are evaluated per pick. No match changes nothing.

**A grant's state**. `setState` and `adjustState` may name granted content's saved
state with `grant`, its qualified ID, beside its node: `entry` (the copy) or a pick's `path` and
`option`. An active holder grant of that content on that node must exist (`not-granted`, data
`grant`; an applied entry has none). The keys, types and bounds are those the granted content's
type and item declare. Its current value is the saved one, else the grant's `state` value, else
the declared default; a value equal to that default is dropped (an empty entry, and an empty
`grants`, with it). A preset pick the path goes through is saved first, as `choose` saves it.
`grants: { where, limit? }` names every active holder grant, in activation order (an item once
per node), whose content declares the change's `key` and whose `where` holds with `item` the
granted item and `self` its state; `by` and `value` are evaluated per grant. No match changes
nothing.

**Preset choices**. `choose` and `unchoose` on a choice a grant presets are
`preset-choice` (data `path`). A `choose` (or a pick's `setState`) whose path goes through a
preset pick first saves a pick of that option, with no state, to hold what nests under it.

**Quantity**. `setQuantity` and `adjustQuantity` change a copy's
`quantity` (any copy, in inventory or features; absent means 1). The result is always written,
1 included. It never goes below 0: such a change is `out-of-range` and rejects the batch, so an
action that spends one aims at `where: self.quantity > 0` instead. A copy at 0 stays, with its
picks, templates and state; removing it is a separate `removeItem`, which by query sees the new
quantity.

**Formula defaults.** When `addItem` adds a copy, each numeric, boolean or dice state key whose
`default` is a formula and that has no value is evaluated with `item` bound (the copy's item
with its templates) and input fields only. A numeric result outside the key's `min`/`max`
(evaluated the same way) rejects the change with `out-of-range`, as `setState`
would; otherwise the result is written into the entry's `state`. Values the change gives
explicitly, and literal defaults, are checked for type only. `applyTemplate` does the same for
the state keys the template itself declares that have no saved value, with the copy's
templates, the new one included: a staff template's
`charges: { default: item.maxCharges }` is saved when it is applied.

### Routing an adjust

An `adjust` on field F with amount `by`, `tags` and optional `situational` choices:

1. **Incoming-change effects.** Take the active instances whose target is `incoming`, whose
   `fields` (if given) include F, and whose `tags` (if given) match one of the change's tags.
   After the character's own come the incoming-change effects of each situational choice the
   change selects ([below](#situational-choices-on-a-change)), with source
   `{ type: situational, id }`.
   Group them by operation and apply [stacking](#stacking) to each group (dice compare by their
   average); `playerChooses` keeps the recommended (highest) instance, since there is no
   pick to read. Each counted `add` whose value is dice is rolled, in instance order
   ([below](#dice-on-incoming-changes)). Apply them in effect order to the amount: `set`, `add`
   (a rolled one adds its total), `multiply`, then `atLeast`/`atMost`.
   Round each multiplication with the effect's `rounding`, else the field's, else the game's:
   the signed amount when
   `settings.roundIncoming` is `value`, its magnitude (sign restored) when it is `magnitude`.
   The sheet used is the character before this change. The effects' `when` and `value` see
   `incoming`: `amount` is `by` as requested, before any effect, so every
   instance sees the same number; `field` is F's qualified ID; `tags` are the change's tags.
   They also see `situational`: the choices visible from the effect's pack, each with the value
   the change gives, else its default.
   An instance **counted** when its `when` held and stacking kept it.
2. **Absorbing.** If the amount is negative, each field in F's `absorbedBy`, in order, takes as
   much of it as it can before reaching its minimum.
3. **The field** takes the rest.
4. **Overflow.** If the result passes the bound of one of F's `overflow` entries (`at: max`:
   above `max`; `at: min`: below `min`; or reaches it, when `inclusive`), the engine adjusts
   `into` by `by` (default 1), and F is set to `reset`. The adjust on `into` is routed in turn
   (without incoming-change effects), up to `maxOverflowChain` adjusts in all. The entry
   doesn't fire when clamping would take all of that adjust: on the values stored so far, its
   `by` isn't 0, no absorbing field of `into` can take any of it (for a negative `by`), no
   overflow of `into` fires (by this same test), and `into` is already at the bound it moves
   toward. F is then clamped (step 5).
5. **Clamping.** Otherwise the result is clamped to `min`/`max`.
6. **`then`.** After the adjust is fully routed, each instance that counted in step 1 applies its
   `then` changes, in instance order, to its own entry, before the next change in the batch: for
   an applied activation the applied entry whose `self` it sees (for content an applied grant
   reaches, the granting entry), otherwise its copy. A `setState` or `adjustState` changes the
   state `self` reads the key from: for picked content that declares the key, its pick's state,
   as the same change with the pick's `path` and `option` would; for held granted content that
   declares it, its grant's saved state, as the same change with `grant` and the grant's node
   would (a value equal to its default is dropped; two grants of one item on one node share it);
   otherwise the entry's state (for picked or granted content, the owning copy's). A change to a
   grant that is no longer active (an earlier `then` turned its `when` off) is skipped. A
   `removeEffect` (applied effects only) removes the applied entry. Their `value` and `by` are
   evaluated with the instance's `item`, `self` and `incoming`, on the same sheet as step 1.
   They are checked like the same changes given to applyChanges, and a failure rejects the
   batch. Once an entry is removed, every later `then` change aimed at it in this step is
   skipped, so two effects of one ward that both counted remove it once. They are not adjusts,
   so nothing routes or triggers on them. A change with nowhere to go is skipped: content picked
   in the rules' choices, or granted by the rules, has no entry, so a change to the entry's state
   is skipped (a key its pick declares still changes on the pick). `then` where no entry can exist is a load error (`then-without-copy`).

Each step that changes a field is reported in `adjustments`, in order, as
`{ field, by, requested?, taken?, reason, clamped? }`, with qualified field IDs:

1. **`absorbed`:** one entry per absorbing field that took part of the amount.
2. **`requested`:** the field the change named.
   - `by` is what the field took, after effects, absorbing and clamping.
   - `requested` is the change's original amount.
   - `taken` is the amount after step 1's incoming-change effects, before
     absorbing, clamping and overflow. It differs from `requested` only when an incoming-change
     effect counted. Other entries have none.
   - `rolled` (only when an incoming-change effect rolled dice) lists each roll in instance order
     as `{ source, dice, faces, total }`: the effect's source with its effect ID, the dice as
     text, every face used, and the total.
   - With an overflow, `by` is the unclamped amount, so the value may briefly be past its bound.
3. **`overflow`:** the adjust on `into`, followed by that field's own steps if it overflows in
   turn.
4. **`reset`:** the jump of the named field to its `reset` value.
   - **`carry`**: with `carry: true`, the excess routed into the field again, its
     entry `{ field, by, reason: carry }` followed by its own steps if it overflows in turn.
5. **`then`:** after the adjust's own entries, one `{ key, value, source }` per `then` state
   change, with the state's address as the setState that makes it takes: `entry` (a copy or an
   applied entry), a pick's `path` and `option`, or `grant` with the grant's node (`entry`, or
   `path` and `option`); then the state key, its new value, and the effect instance's source
   with its effect ID (`effect`, when the effect has one). A
   `removeEffect` adds `{ entry, removed: true, source }` instead. A skipped change adds nothing.

`clamped: true` appears only when clamping changed the amount. So FitD stress at 8 taking 3
reports stress +3 (`requested`), trauma +1 (`overflow`), then stress −11 (`reset`). Mothership
armor with AP 5 and DR 2 taking 8 damage reports health −1 (`requested`, from −8 + 5 + 2), then
`{ entry, key: destroyed, value: true }`.

The change log holds only the adjust: replaying it routes the same way and applies the same
`then`.

#### Situational choices on a change

An `adjust` may carry `situational`: the receiving player's
[situational choices](rules-and-fields.md#choices-on-incoming-changes) for it, a map of
qualified IDs to values, such as 5E's Uncanny Dodge on one attack.

- An unknown ID is `unknown-id`; a value of the wrong type for the choice is `wrong-type`.
- A choice is **selected** when it is a boolean that's true, or another type with a value other
  than its default. A selected choice must be offered on the character before the change
  (`available`, as computeSheet lists it) and have an `incoming` that matches the change (its
  `fields`, if given, include F; its `tags`, if given, match one of the change's). Otherwise the
  batch is rejected with `situational-unavailable` (data: `situational`, the qualified ID).
- Each selected choice's incoming-change effects join step 1 after the character's own, in
  choice order; its roll effects don't apply. A choice left at its default adds nothing.
- The choices reach only this change: not its overflow (which skips incoming-change effects) and
  not the batch's other changes. An attack split into several adjusts carries them on each.
- `changes` returns the adjust with its `situational`, so a logged batch replays the same.
- An action never proposes `situational`: the target's player chooses, on the target's side.

### Dice on incoming changes

An incoming-change `add` may be dice: MÖRK BORG armor takes a d2, d4 or
d6 off every hit. applyChanges stays a reducer that replays exactly, because the faces live in
the change:

1. **Faces.** An `adjust` may carry `faces`, a list of integers. Each counted dice `add` of its
   routing is rolled in instance order by [formulas.md](formulas.md#rolling-dice-values), taking
   faces first from `faces`, in order, then from the dice function, if one was given. Overflow
   adjusts skip incoming-change effects, so they never roll.
2. **Too few.** When `faces` runs out and there is no dice function, the batch is rejected with
   `faces-required` (`path: /changes/<i>`). Its data lists every dice `add` the adjust rolls,
   `dice: [{ source, dice }]` in instance order, and `supplied`, the number of faces given. An
   app that wants the player (or a server) to roll catches it, rolls those dice and resends the
   batch with `faces`.
3. **Too many.** Faces left over after the adjust is routed are `faces-mismatch` (data
   `{ supplied, used }`). A face off the die, given or from the dice function, is
   `invalid-face`.
4. **The output.** `changes` is the batch as applied: each adjust that rolled carries every face
   it used in `faces`, supplied and rolled; every other change is as given, so a batch that
   rolled nothing comes back unchanged. The `requested` entry of `adjustments` lists the rolls
   (`rolled`).
5. **Replay.** Apps log `changes`, not their input. A logged adjust holds its faces, so replaying
   it needs no dice function and builds the same character. Replayed without one, a log that
   lost its faces fails loudly with `faces-required` instead of rolling again.

The [proposed sheet](engine-actions.md#the-proposed-sheet) applies its batch with no dice
function, so a step that reads it after a proposed adjust that would roll fails with
`proposed-changes-failed`.

### Follow-ups

Follow-ups ([rules-and-fields.md](rules-and-fields.md#follow-ups)) are of two kinds: **derived**
offers (`while`), which computeSheet works out from the character, and **ephemeral** ones (`on`,
`becomes`), which the applyChanges that triggered them stores in the character file (`followUps`)
until they are acted on or dismissed. The engine runs and applies neither.

1. **What the character has.** The rules' follow-ups in load order, then each holder activation's
   in instance order (a content type's before the item's): copies, their templates, and content
   they grant or pick. Content in the `applied` list has none.
2. **Offered**. Each `offerFollowUp` change of the batch, in order, names a
   follow-up (`followUp`, and `source` for content's) that a loaded pack must declare
   (`unknown-follow-up` otherwise, rejecting the batch). After the batch it is the declaration
   the character has with that `followUp` and `source`, as a stored one is found; with none, or a
   derived (`while`) one, nothing is stored. Otherwise it fires as a triggered one does (its
   `when` and action checked, below), its `params` the declaration's with the change's over them,
   and no `cause`. Offered follow-ups come before the triggered ones.
3. **`on`.** After a successful batch (strict mode included): for each entry of `adjustments` on
   the follow-up's field, in order, whose tags include one of `on.tags` (a tag matches its
   subtags), or any such entry without `on.tags`. An entry's tags are the change's tags for
   `requested` and `absorbed` entries, the overflow's `tags` for `overflow` entries, and none for
   `reset` entries; `adjustments` doesn't report them. `change` is `{ by, requested, taken,
   reason, clamped, tags }`, `requested` and `taken` 0 and `clamped` false when the entry lacks
   them.
   - **`once`**: the follow-up fires at most once per batch, when at least one
     entry matches, and `change` is the matching entries summed: `by`, `requested` and `taken`
     the sums (absent parts counting 0), `tags` the union in entry order, `reason` the first
     entry's, `clamped` true if any entry's is. `when` and every formula are evaluated once, on
     the sum.
4. **`becomes`.** The condition is evaluated on the character after the batch and, for the same
   declaration (the rules', or the same content on the same copy and choice path), on the
   character before it, with the same links. It fires when it holds after and not before.
   Content the character didn't have before counts as false before. It isn't stored while an
   entry from the same declaration (the same `followUp` and `source`) is still stored after the
   batch's lapsing (below), and `followUps` doesn't list it then.
5. **Storing.** `when` and every formula are evaluated on the character after the whole batch. A
   follow-up that fires is stored, in the order above, as `{ id, followUp, source?, to?,
   character?, params?, cause? }` (`character.schema.json#/$defs/followUp`):
   - `id`: `<the follow-up's own ID>-<n>`, the smallest `n` from 1 that no stored follow-up uses,
     those stored earlier in the batch included;
   - `followUp`: `<pack>:<id>` for the rules', `<qualified content or type ID>#<id>` for
     content's, with `source` naming the content and copy as computeSheet's sources do;
   - `to`: for a follow-up to a link, `{ link }` with the qualified slot, and `character` the
     linked character's ID when the slot is filled. It is stored on this character, since one
     applyChanges writes one file;
   - `params`: for an action, the evaluated parameters it fixes, leaving out any whose formula
     gives `null`;
   - `cause`: for `on`, the `change` it fired on (with `once`, the sum) and its `field`.
6. **Not stored:** a follow-up whose `when` is false, whose action isn't available after the
   batch (its `available` is false; for a link the action isn't checked), or whose formulas fail
   to evaluate.
7. **Output.** applyChanges' `followUps` lists the follow-ups this batch stored, as
   [the offer list](#the-offer-list) lists them.

Storing more than `maxFollowUps` in one batch, counting each copy of a `forEach` change in a
stored follow-up's `changes` as one more, rejects the batch with
`safety-limit-exceeded`. Storing depends only on the batch and the character, so replaying a
change list stores the same follow-ups; acting on or dismissing one is a change in the list too.

**Lapsing**. A stored entry whose follow-up is a `becomes` one is owed only while its
condition lasts. After every successful batch, before anything is stored, applyChanges deletes
each stored entry whose follow-up is a `becomes` one and:

- whose declaration (the one the character has with the same `followUp` and `source`, as
  [the offer list](#the-offer-list) finds it) has a condition that is false on the character
  after the batch, or fails to evaluate. `when` isn't part of it: it gates only the moment the
  follow-up fires;
- whose declaration the character no longer has, though a loaded pack declares that `followUp`
  as a `becomes` one: content the character lost counts as false; or
- that follows another stored entry from the same declaration, in file order.

The deletion is not a change in `changes`, and `followUps` doesn't report it. `on` entries are
events (two hits call for two concentration checks, each stored until run or dismissed) and
trigger-less ones have no condition; neither lapses. An entry whose `followUp` no loaded pack
declares is kept. A `becomes` follow-up that an `offerFollowUp` change names is stored only if
its condition holds after the batch, and not while an entry from its declaration is stored.

**Clearing.** `clearFollowUp` (proposed by startAction for a stored follow-up's run, and last in
its listed `changes`) and `dismissFollowUp` delete the stored entry with their `id`. Clearing one
that isn't stored is no change, so an action's changes still apply after another app cleared it;
dismissing one is `unknown-follow-up`. An `on` or trigger-less follow-up whose content the
character loses stays stored, listed without its action or changes, until it is dismissed; a
`becomes` one lapses.

### The offer list

`offers` is what the rules offer the character now, from its file alone, so every
app, a reload and an import see the same list:

1. **Ephemeral:** each stored follow-up, in file order, except those that have lapsed
   ([Follow-ups](#follow-ups)), so a file written by hand or by an older engine lists only what
   is owed; startAction's `action.followUp` naming a lapsed one is `unknown-follow-up`. Its
   declaration is the one the character has with the same `followUp` and `source`. Its `action`
   is named as when it was stored, even if the action isn't available now; its `params` are the
   stored ones. A `changes` consequence is resolved now, on the current character, with `change` the stored `cause`, like an action's
   `changes` step; a change whose `when` is false is left out, and one whose formulas fail leaves
   `changes` empty. `cause` is the stored one.
2. **Derived:** each `while` follow-up whose condition and `when` hold on the character, whose
   action is available and whose formulas evaluate, in declaration order. One with `create`
   is listed only while its slot is empty: the file saves no link for it and the
   app passes no view. Its `id` is the
   follow-up's ID, with `@<instance ID>` for content on a copy; the same `id` is listed once.

Each is `{ id, kind, followUp, source?, to, character?, action?, params?, changes?, create?,
required, cause? }`:

- `kind`: `ephemeral` or `derived`; `required` is the declaration's (false when absent, or when
  the character no longer has it).
- `action`: startAction's `action` input (`{ id, entry?, source? }`, as computeSheet lists the
  action), with `followUp: <id>` for the character's own offer; `params` with it.
- `changes`: resolved, ready for applyChanges; for the character's own ephemeral offer they end
  with `{ type: clearFollowUp, id }`.
- An offer to a link has no `followUp` in its action and no clearing change: the app runs it on
  the linked character and clears it here.
- `create`: `{ link, start, pack, params }`, a new character for an empty slot,
  with no `action` or `changes`. `link` is the qualified slot; `start` the creation start as
  `<pack>:<id>` (the ruleset's `creation` entry with that `pack` and `id`); `pack` the start's
  pack, which the new character uses; `params` the evaluated `create.params`, leaving out any
  that give `null`, passed over the start's own. The app makes a character with `creating: true`
  and `pack`, runs the start (guided, or automatic when it is `random`), applies its changes and
  saves the new ID in this character's `links`, which ends the offer. The offer's ID isn't
  startAction's `action.followUp` (`unknown-follow-up`): the start runs on the new character.

A derived offer is never stored and can't be dismissed: it lasts exactly as long as its condition
holds. "Not now" is the app's display choice. `required` is advisory: nothing blocks, it is not a
rules issue, and an ephemeral one can still be dismissed.
