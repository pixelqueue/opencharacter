# @opencharacter/engine

## 0.3.0

### Minor Changes

- 033d16d: computeSheet's `activations` marks each standard copy, saved or not, with `standard: true`, so an
  app tells a copy it may remove (a `copy` without `standard`) from one every character holds.
- 033d16d: A result band may mark its set's success threshold, `success: true`: the band a roll needs, what
  an app shows before the roll ("what you need"). A set marks at most one. The roll summary
  (`needs.summary`, a log entry's `summary`) and `text.rollTargets` carry the mark on its band; a
  pack's band condition text that needs a test's value no longer shows its raw template when the
  band has no tests. Every pack marks its banded checks, saves and attacks: the DC check's success,
  the attack's hit, Fate's `succeed` against the opposition, FitD's action roll at `partial` (a 4
  or 5 does what the player set out to do), Mothership's success and panic `pass`, Mörk Borg's test
  against the DR. Ladders, tables and fortune rolls have no threshold and mark none.
- 033d16d: A repeated choice step over values has `steps.<id>.values`: the picked values in order, numbers
  staying numbers, so Arcane Recovery sums `sumList(steps.slots.values, x)` instead of mapping
  each option ID back to its value (#73).
- 033d16d: Formulas read content by ID. `itemField(id, name)` is an item field of that content as merged
  at load (`extends`, overrides and its type's defaults; no copy's templates), read as
  `item.<name>` is; `itemField(id, name, default)` gives `default` when the content lacks the
  field or the ID names none, else `no-such-key`. `itemTags(id)` is its tags. The ID may be
  computed (a pick); the name is a string literal. Both are bound wherever a character is,
  activation conditions included, so a pick's fields need no mirror field. At load, an item field
  name no content type declares, a literal ID naming no content, or one whose type lacks the
  field, is `unknown-reference` (#154).
- 033d16d: Content is listed in content order, the load order then each pack's content order, instead of by qualified ID: the ruleset's `content`, query matches, choice and choice step content options and random draws over them. A dependency's content comes first, so an automatic run's `options[0]` is the core pack's whatever an add-on pack is called, and a character's homebrew comes last.
- 033d16d: Formulas read the picks of content other than their owner. `picksOf(content, choice)` is the
  picks of that content's choice on every activation of it, granted ones included, in activation
  order (a grant's preset picks where it presets the choice); it is bound wherever a character is
  but activation conditions, field formulas, constraints, display hints and situational choices
  included. `grantedPicksOf(content, choice)` is the saved picks of a choice of content the
  formula's owner grants, bound where `picksOf(choice)` is, activation conditions included, so a
  grant can preset its pick from another grant's (Starfinder 2e's Fixation). Both take string
  literals; unknown content or choices are `unknown-reference` at load (#69).
- 033d16d: Formulas count saved picks and active grants: `countPicks(cond)` goes over every saved pick of
  content (file order) with `pick` bound to `{ item, type, tags, fields, state }`, declared state
  defaults applied, and `countGrants(cond)` over every active holder grant with `grant` bound the
  same way. `countGrants` is unbound in activation conditions, which decide the grants. A rest's
  `when: countPicks(pick.type == 'invocation' && pick.state.used) > 0` proposes its reset only
  when a pick was used (#70).
- 033d16d: `describeAction(ruleset, character, action, links?)` gives an action computeSheet lists, wherever
  it is defined (a rules action, one inline on an item or its content type, one an item's `use`
  offers): its defining action (`definedBy`, as `needs.action` names it), tags, results, roles
  (`{ role, min, max?, pack? }`) and parameters in declaration order, each with `required`,
  `default`, the value a `use` fixes, `min` and `max` evaluated on the sheet, an enum's values (an
  add-on's included) and, for a field, content or tag parameter, every ID startAction takes, its
  `where` applied (`describe-action.schema.json`). An action not listed for the character is
  `unknown-action`.
- a26226f: computeSheet lists the members of actions and content groups: `groups[].actions` (indices in
  `actions` its `where` matches) and `groups[].items` (activations or applied entries, sorted by
  `sectionBy`, then `sortBy`, then instance order, each with its `section`). Each activation's
  `hiddenState` names its state keys not shown (`hidden`, or a state hint's `showWhen` false), so
  apps evaluate no display formula themselves.
- a26226f: computeSheet evaluates display visibility: each value has `shown` (not `hidden`, its `showWhen`
  holds, and it is in no fields group or a shown one), and `groups` lists every display group with
  `shown` and a fields group's member fields. `showWhen` sees the copy aggregates and `hasChoice`,
  so a `countCopies` condition no longer needs an app-side evaluator.
- 033d16d: Error text for equal bounds and enum values: `errors.out-of-range.exact` words an `out-of-range` whose bounds are equal (`"Effort" must be exactly 1.`), and `errors.wrong-type.values` a `wrong-type` for an enum, whose data now carries the enum's `values`. `text.error` names each value by its label (a parameter's from its action's text, a field's from the field's) and joins them as alternatives (`"For" must be The scene or The day.`).
- a26226f: Exports: `export.schema.json` is one file of characters with every pack version they pin, each by
  reference (`id`, `version`, optional `url` and `integrity`) or embedded as a pack release (a
  bundle). `integrity` is the SHA-256 of the release's canonical JSON, and decides whether the
  receiving app's own copy is the same release. The engine adds `createExport`, `readExport` and
  `releaseIntegrity`.
- 033d16d: Additive choice options: a pack's rules' `extendChoices` adds items, written values or inline options to a dependency's content or rules-level choice (`<pack>:<content id>` or `<pack>:rules`, then the choice, `<choice>/<option>/<choice>` for a nested one) without overriding the owner, after the choice's own and in load order, so two add-ons never collide. Added inline options read the adding pack's fields and are named in its text under the owner's key; the ruleset's `optionOrigins` names each added value's and inline option's pack, which `createText` takes. The rules' `option` and `changes` effects now reach tagged action steps too (`<pack>:rules#<id>`, named `rules.options.<id>.name`), so an add-on offers its own option in a dependency's creation step. A bad addition is `invalid-extension`; dropping one is an interface change (`extension-removed`).
- 033d16d: `fieldId(pattern, key, …)` gives the qualified ID of the field a family pattern names for a key, in the pack that added the key, so a core change, effect or `{ formula }` field target built from a family key reaches the field an add-on declared for its own key. Formulas evaluated over input fields (activation conditions, state defaults, template values) now read `fieldOf` from the adding pack too.
- 033d16d: Grant-only content: a content type or an item may say `grantOnly: true`, content held only
  through grants and picks (a class feature, a subclass, an ancestry trait). `addItem` of it, in
  an app's batch or an action's proposed changes, is the new runtime error `not-addable` (data:
  `item`; standard text in `i18n/en.yaml`); grants and choices take it as before. An item's own
  `grantOnly` replaces its type's, and homebrew items follow their type. The loaded ruleset gives
  each item the value that applies (`content.<id>.grantOnly`), so apps leave it out of add-item
  catalogs. `pnpm validate` reports a proposed `addItem` of grant-only content (#172).
- 033d16d: A `group` step repeats a sequence of steps: one pass of its `steps`, then another while
  `repeat.while` holds, up to `repeat.max` passes (and the new safety limit `maxGroupPasses`).
  A step in pass `n` is at `<group>[<n>]/<step>`; `steps.<group>` lists the passes, and after the
  group each step reads as its latest result. Fate's reroll-and-reroll-again needs no copies of
  its steps (#80).
- 033d16d: Item fields and state keys of type `id`, `set` or `list` of a content type or `field` may say `where`, a condition over each candidate as `item` that reads only `item` (#166). An item's own value outside it is `invalid-item-field` (`not-allowed`) at load; a copy's own value (`addItem`, `setField`) or a state value (`addItem`, `setState`, `applyEffect`) outside it is `invalid-option`, with the item field or state key as `target`. loadRuleset gives each such declaration `options`, the IDs it takes, for an app's picker.
- 033d16d: Templates kept on content without a copy are kept per activation, not per item: a `content`
  query that reads the keeper also sees `owner`, the candidate's owner (`owner.id`, its key root as
  `choice.owner`, and `owner.item`), so Eldritch Spear lengthens a cantrip only where the Warlock
  knows it. Breaking: computeSheet's `templated` lists such content once per activation, with
  `activation`, its index in `activations` (#76).
- 033d16d: Item fields may be of the new type `list`: members of kind `of` in the order written, where a
  `set` comes out sorted; duplicates are allowed unless the declaration says `unique: true`.
  Formulas see a `list<string>` in that order, content and field members qualified as a set's
  are. A value that isn't a list, or a `unique` list with a member twice, is
  `invalid-item-field` (`wrong-type`) at load; a per-copy value is checked the same way. `list`
  is for a content type's `fields` and `templateFields` only: on a state key or parameter it is a
  validation error (#152).
- a26226f: Loading checks content items' `fields` against their content type: a missing required field
  (after `extends`), an undeclared name or a value of the wrong shape is the new load error
  `invalid-item-field` (data: `item`, `field`, `reason`, `pack`), with a path to the field. A
  character's homebrew gets it as `homebrew-error` at `/homebrew/content/<i>/fields/<field>`, so
  an app can show it on its custom-item form (#104).
- 033d16d: Open enums reach action parameters, items' own state and view fields: `open: true` on a rules action's or an item's inline action's parameter, or on a state key an item declares, takes values from dependent packs' `extendEnums` (`<pack>:actions.<action>.params.<param>`, `<pack>:<item>.actions.<action>.params.<param>`, `<pack>:<item>.state.<key>`), checked by `startAction`, changes and `pnpm validate`; closing one is `enum-closed`. A declared view field marked `open: true` follows the open enum field of its ID, so a participant's or linked character's view may hold an added value. The ruleset's `familyOrigins` names the pack that added each family value; `createText` takes it (and names added parameter and item state values through `enumOrigins`), so a core values step over a family names an add-on's key from the add-on's text.
- 033d16d: Open enums: a rules field's or a content type's enum marked `open: true` takes values from the packs that depend on its pack, listed in their rules' `extendEnums` by the enum's address (`<pack>:types.<type>.fields.<field>`, `<pack>:types.<type>.state.<key>`, `<pack>:fields.<field>`) and named in their own text under the enum's key. Loading, item fields (`invalid-item-field`), saved values, changes and `pnpm validate` see the merged list; the ruleset's `enumOrigins` names each added value's pack, which `createText` takes to name it. A bad addition is `invalid-extension`; closing an open enum (`enum-closed`) and dropping an added value (`extension-removed`) are interface changes.
- 033d16d: A proposed `setState` or `adjustState` may name `pick: owner` or `grant: owner`: the pick or
  holder grant of the content the change is written on. In an option or `changes` an effect adds,
  that is the effect's content (an invocation spending its own use on the spell it casts), while
  `pick: self` and `grant: self` keep naming the action's content's (#77).
- 033d16d: Advantage and disadvantage reach a roll's parts: with a `parts` target and `of: roll`, the
  matching parts' items are rolled again as a group and the better or worse total kept, the roll's
  other items rolled once (5E's Savage Attacker: the weapon's dice, not Sneak Attack's). Part
  sources are counted apart from the roll's own; a roll made again whole adds none. A dice pause's
  `repeat` gains `items`, the items rolled again, and `text.dice` words them together:
  "(2d6, rolled twice, keep the higher total) + 3d6" (`dice.grouped`) (#71).
- 033d16d: A choice step over pending choices may take `pending: { path }`, a choice path as a `choose`'s:
  only the pending choices at it or under it are asked, so a crew advance asks the abilities of
  the picked crew type without every other pending choice (#74).
- 033d16d: Item fields a content type marks `perCopy: true` may have a copy's own value, saved in the
  entry's `fields` (`addItem`, and the new `setField` change; `null` removes one) and merged into
  its `item` after its templates, so every reader reads `item.limit` for a custom stunt too. The
  new error `not-per-copy` names a field that isn't `perCopy`; a copy with own values is listed in
  `templated`. The new upgrade step `stateToField` moves a state key to the copy's own field
  (#78).
- 033d16d: A roll effect's `then` changes are no longer held by a `hold` action step: they record a roll
  the used action made, so a held attack whose other changes are never released still ends
  Sapped or spends a boon's use, and the effect, marked as fired for the run, isn't left unspent.
- 033d16d: A roll effect proposes its `then` at most once per action run: a reroll, or a second roll the effect changes in the same run, no longer proposes a second `removeEffect` (which applyChanges rejected) or spends a second use.
- 033d16d: A roll effect's `then` may be a rule, `{ changes, when, once, to }`. `when: applied` fires it
  when the effect was in play on the roll (its target matched and its `when` held), even if
  stacking dropped it or an opposite kind cancelled it, so 5E's Sapped ends on the next attack
  roll either way; `changed` (the default) keeps today's rule. `once: roll` proposes it once per
  roll step run (each pass of a group its own) instead of once per action run (the default,
  `action`). `to` sends the changes to another character (a role, `target`, a link) as a
  `changes` step's, so an attacker's effect that reads its target's view ends the target's entry
  (5E's Vexed); such a `then` needs no entry of its own and may sit on the rules' effects (#153).
- 033d16d: Roll effects may carry `then`: after a roll step, each effect that changed the roll (its `when`
  held, stacking kept it, and it made a difference: an advantage of the kind that applies once
  sources combine, a bound that moved the total, …) proposes its `then` changes once, `to: self`,
  with the roll step's path. `entry: self` resolves to the copy or applied entry (or the pick's or
  grant's state for a key it declares), and `removeEffect` ends an applied entry, so a "next roll"
  effect like 5E's Sapped ends itself. A `then` change may also name `pick: owner` or
  `grant: owner`, the pick or holder grant that activated the effect's content, on incoming-change
  effects too (#68).
- 033d16d: A grant may say `forEach`, a list evaluated as its `when` is: it is made once per element, with
  `x` bound in its `when`, `item`, `state` and `choices`. Its `item` may be `{ query }`: every
  visible item the query matches, each its own grant. So one core grant covers every key of an open
  family, an add-on's key and content included:
  `{ forEach: keysOf('psychic'), when: "fieldOf('skills.{psychic}.level', x) >= 0", item: { query: { type: technique, where: item.core && item.discipline == x } } }`.
- 033d16d: `countPicks` and `countGrants` nest inside another aggregate's arguments, evaluated once per outer
  element with its root bound (`sumFields(countPicks(f.id in pick.fields.upgrades) > 0 ? 0 : f.value)`).
  `picksOf('rules', choice)` (or `'<pack>:rules'`) reads a rules-level choice's saved picks wherever a
  character is, activation conditions, constraints and display hints included; a choice the rules
  don't declare is `unknown-reference` at load.
- a26226f: Characters get spec-level upgrades. A spec version that changes the character file's shape ships
  a spec upgrade (`spec-upgrade.schema.json`, listed in `data/spec-upgrades.json`; none yet).
  `upgrade` runs the ones between the character's `specVersion` and the engine's, before the packs'
  scripts, then writes the engine's `SPEC_VERSION`, so an upgraded character no longer keeps a stale
  stamp. The report's `spec` gives the old version and the steps that changed the file. A character
  from a newer spec is refused with the new error `character-spec-unsupported`.
- 033d16d: An effect's `target` may be a string formula naming a field, `{ formula }`, evaluated as an
  activation condition when the effect becomes active (`self`, `item`, `pick`, `slot`, the
  character functions and input fields), so one value choice's effects reach the field its pick
  names: `target: { formula: "'skills.lore.' + pick.value + '.granted'" }`. The effect is then as if
  written with that field. An empty string targets nothing; a field that doesn't exist, or one the
  op doesn't take, is a sheet error (`unknown-field`, `type-mismatch`) (#79).
- 033d16d: A template's `string`, `enum` or `id` item field may be `{ formula }`: a string formula read as
  its numeric fields are (with `base`, `prior` and `params`), so a kept template takes a value from
  its keeper's `params`. Kept templates' `params` read `character.applied`, the saved applied
  entries with their state, so a spell's damage type can follow the element of an active spell
  (#75).
- 033d16d: An action (or a `use`) may say `listed: false`: computeSheet leaves it out, but an `action` step
  with `source` or `entry` still runs it while its `available` holds, and so does `startAction`.
  Content can now add its own part to a shared rules action without a button of its own (#81).
- a26226f: The upgrade report's values add `shownBefore` and `shownAfter`: whether the field was shown on
  the old sheet and is shown on the new one (computeSheet's `shown`), each present with its side,
  so an app can leave hidden or irrelevant values out of "what changed".
- 033d16d: A choice step over values names its values by the content the action runs for first:
  `<contentId>.options.<value>.name`, else `<actionKey>.options.<value>.name`. A pause over values
  (and its random draws) carries `needs.content`, the content's qualified ID; `text.option` takes
  `content` in its context and `describeNeed` passes it, and `pnpm validate` accepts the item's
  own value keys. One shared action's values now take per-content text (#72).

### Patch Changes

- a26226f: Action parameters' `min` and `max` are enforced: a number parameter outside them is
  `out-of-range` (data: `target`, `min`, `max`) when the action starts or is handed off. The bounds
  are number formulas evaluated as the action starts, with its `item`, `self`, `situational` and
  the character's fields (`max: effort.free`), and are type-checked at load (#111).
- 033d16d: An `action` step's `source` without `entry` also finds content that is a copy's own item, listed
  by that copy's `entry` (the parent's entry first, else the first): a class added earlier in the
  run under `sheet: proposed` runs its own action by its ID, as `entry` finds it by the new copy's
  ID. Before, only picked, granted and entryless content matched, so the step was
  `unknown-action` (#155).
- 033d16d: A content parameter without `where` is checked too: an ID that isn't an item of its type is
  `invalid-option` when the action starts, and formulas read the qualified ID.
- a26226f: Engine errors carry the data their standard text names: `unknown-name` gives `name` (formula checks no longer give `id`), `unknown-function` gives `function`, `fieldOf()`'s `no-such-key` gives `key` and `family`, `unknown-reference` from actions gives `kind` and `id` (no more `followUp`, `pick` or `grant`), a scope-applied grant's preset choices give `id`, a reapply state key's `wrong-type` gives `target` (was `key`), and `offerFollowUp`'s `unknown-follow-up` gives `id` (was `followUp`). The formula error table says which data each code carries.
- 033d16d: A grant's `item`, `state` and preset formulas read the character functions (`itemField`,
  `countPicks`, `countCopies`, …), as activation conditions do; they failed with `unknown-function`.
- a26226f: An overflow whose adjust on `into` would be clamped to no change (its target at its bound, nothing
  absorbed, no overflow of its own) no longer fires: the field clamps instead. Carried overflow
  stops cycling once its target is full, so more damage never leaves more health and large
  amounts no longer reach `maxOverflowChain` (#100).
- 033d16d: Action parameter errors (`missing-param`, `wrong-type`, `out-of-range`, `invalid-option`) carry
  `action` (the qualified action ID; `<item ID>#<action ID>` for an item's inline action) and, for
  an action started on them, `entry` and `source`. Text names the parameter by its label
  (`"Helpers (+1 each)" must be at least 0.`).
- 033d16d: `upgrade` lists a `requireChoice` step for a character holding the choice's owner as a pick with no nested picks saved yet, not only when it has some.
- 033d16d: A rules action no copy uses reads the rules-level choices with the one-argument `picksOf` in its
  `available` too, as its steps do: computeSheet lists it, and a follow-up's action is checked, with
  the rules' picks, not an empty owner. Conformance cases for a rules action's `available`, a
  follow-up's action check, and the rules-level formulas where `picksOf(choice)` is unbound.
- 033d16d: `checkRelease` no longer reports `state-removed` for an item's state key that the item's content
  type declares in the new release with the same type: its copies keep their saved values. A pack
  may move a key to the type, to open its enum to add-on packs.
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [f44f66c]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [f44f66c]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
  - @opencharacter/spec@0.3.0

## 0.2.0

### Minor Changes

- 44023e4: An `applied` incoming-change effect may carry `then`, and `then` may remove the effect's own applied entry (`{ type: removeEffect, entry: self }`), for effects that end when they trigger (#17).
- c860566: A choice step can take its options from a list: `options: { values, where? }`, a written list or a formula, with `picked.value` and `steps.<id>.value` (#22).
- 44023e4: With `entry` and no `source`, an action step's `use` may name an action the entry's own item defines inline (#18).
- 2c6f736: A grant can preset the granted item's choices (`choices`), and granted content keeps saved state of its own on the owner (`grants: { <item>: { state } }`), changed with `grant: self`, `grant` plus `entry`, or a `grants` query (#23, #35).
- 9999f66: A kept template's `copies` or `content` query may read the keeper (`self`, `picksOf`, input fields), and a template declares `params` its keeper fills from formulas, read as `params.<name>` in its fields (#38).
- e25791e: `keepsTemplates` may give `content: { type, where }` to keep a template on picked or granted content without a copy, such as a spell known; `computeSheet` lists merged items as `templated`, and a block reads a merged item's tags (#19).
- 49a6ba5: New formula function `picksOf('<choice>')`: the saved picks of a choice of the formula's owner, so sibling choices and a copy's values and actions can read them (#20, #37).
- 44023e4: `advantage` and `disadvantage` roll modifiers take `of: roll` to roll the whole roll again and keep the better or worse total; results gain `rolls`, a dice pause gains `repeat`, and the text gets `dice.repeat` (#34).
- 44023e4: Changes and choice steps give `steps.<id>.added`, the instance IDs of the copies their `addItem` changes add, so later steps can aim at a new copy (#36). A changes step's result is now typed at load.
- 8560185: An incoming-change effect's `then` on picked or held granted content changes the state its `self` reads: its pick's state or its grant's saved state, for keys that content declares. A rules-level pick's own state is writable this way too, though it has no entry. Output change: `adjustments` address a `then` state change as a setState would, with the pick's `path` and `option`, or with `grant`, instead of always the copy's `entry`. A change to a grant that an earlier `then` turned off is skipped.
- 44f9c44: Upgrade steps `removeState`, `moveState` (a copy's state to a pick or to granted content's saved state) and `removeChoice`; `renameState` also renames picks' and grants' saved state. `renameState`, `removeState` and `moveState` take `item`, limiting the step to one item's copies, picks and grants (with `type`, both must match). A choice step's `owner` can be a path to a choice nested in an inline option (`classes.operative/specialization/ghost`). `checkRelease` accepts the new steps as coverage: `removeState` and `moveState` for `state-removed` (with `item`, only that item's key), `removeChoice` for `choice-removed`, and steps naming nested owners for nested choices. It no longer reports written `values` replaced by a formula as removed options.

### Patch Changes

- 8560185: A follow-up's changes keep `pick: self`, `grant: self`, `path`, `option`, `picks` and `grants`, resolved as an action's are.
- 29e83eb: `IMPLEMENTS_SPEC` follows `SPEC_VERSION`: the major.minor of the spec the engine ships with.
- 7f34bf4: `renameState` with `item` no longer renames the key on every homebrew item: in the homebrew, and on saved copies, `renameState`, `removeState` and `moveState` with `item` apply to that item and homebrew items that extend it (with `type`, both must match). `renameChoice`'s `from` and `to` may be prefixed choice keys (`<qualified id>/<choice>`), moving a granted or template content's saved pick onto its owner's own choice. Upgrade docs and the upgrade schema describe every step parameter.
- Updated dependencies [44023e4]
- Updated dependencies [c860566]
- Updated dependencies [29398e1]
- Updated dependencies [44023e4]
- Updated dependencies [2c6f736]
- Updated dependencies [9999f66]
- Updated dependencies [e25791e]
- Updated dependencies [49a6ba5]
- Updated dependencies [44023e4]
- Updated dependencies [44023e4]
- Updated dependencies [7f34bf4]
- Updated dependencies [44023e4]
- Updated dependencies [8560185]
- Updated dependencies [44f9c44]
- Updated dependencies [769fe80]
  - @opencharacter/spec@0.2.0

## 0.1.1

### Patch Changes

- e050f92: An action step run from an inline action of content granted on a copy now runs the used rules
  action with that content as its `item` (the step's `entry` and `source`), not the copy's own item.
