# @opencharacter/spec

## 0.3.0

### Minor Changes

- a26226f: computeSheet lists the members of actions and content groups: `groups[].actions` (indices in
  `actions` its `where` matches) and `groups[].items` (activations or applied entries, sorted by
  `sectionBy`, then `sortBy`, then instance order, each with its `section`). Each activation's
  `hiddenState` names its state keys not shown (`hidden`, or a state hint's `showWhen` false), so
  apps evaluate no display formula themselves.
- a26226f: computeSheet evaluates display visibility: each value has `shown` (not `hidden`, its `showWhen`
  holds, and it is in no fields group or a shown one), and `groups` lists every display group with
  `shown` and a fields group's member fields. `showWhen` sees the copy aggregates and `hasChoice`,
  so a `countCopies` condition no longer needs an app-side evaluator.
- a26226f: Exports: `export.schema.json` is one file of characters with every pack version they pin, each by
  reference (`id`, `version`, optional `url` and `integrity`) or embedded as a pack release (a
  bundle). `integrity` is the SHA-256 of the release's canonical JSON, and decides whether the
  receiving app's own copy is the same release. The engine adds `createExport`, `readExport` and
  `releaseIntegrity`.
- a26226f: Loading checks content items' `fields` against their content type: a missing required field
  (after `extends`), an undeclared name or a value of the wrong shape is the new load error
  `invalid-item-field` (data: `item`, `field`, `reason`, `pack`), with a path to the field. A
  character's homebrew gets it as `homebrew-error` at `/homebrew/content/<i>/fields/<field>`, so
  an app can show it on its custom-item form (#104).
- a26226f: Prerequisite text is a phrase, the requirement alone ("Scout Dedication"); the new standard text `issues.prerequisite-not-met.owner` (`{owner} requires: {requirement}`) names its owner. `text.issue` wraps a pack's prerequisite text with the owner's name, content or inline option, and `keys.issueKey` finds an inline option's prerequisite text (`<item>.choices.<choice>.options.<option>.prerequisites.<id>`). `pnpm validate` warns on prerequisite text that ends with a period or starts with "Requires" or "Needs".
- a26226f: Characters get spec-level upgrades. A spec version that changes the character file's shape ships
  a spec upgrade (`spec-upgrade.schema.json`, listed in `data/spec-upgrades.json`; none yet).
  `upgrade` runs the ones between the character's `specVersion` and the engine's, before the packs'
  scripts, then writes the engine's `SPEC_VERSION`, so an upgraded character no longer keeps a stale
  stamp. The report's `spec` gives the old version and the steps that changed the file. A character
  from a newer spec is refused with the new error `character-spec-unsupported`.
- a26226f: Standard text by an error's data: `errors.out-of-range.min` and `errors.out-of-range.max` for an `out-of-range` with only one bound, and `errors.safety-limit-exceeded.<limit>` for each safety limit. `text.error` and `text.issue` use them, and show `errors.other` instead of the raw template when a message misses an argument. The `safety-limit-exceeded` and `out-of-range` descriptions in `error-codes.json` say what their data holds.
- a26226f: The upgrade report's values add `shownBefore` and `shownAfter`: whether the field was shown on
  the old sheet and is shown on the new one (computeSheet's `shown`), each present with its side,
  so an app can leave hidden or irrelevant values out of "what changed".

### Patch Changes

- a26226f: Action parameters' `min` and `max` are enforced: a number parameter outside them is
  `out-of-range` (data: `target`, `min`, `max`) when the action starts or is handed off. The bounds
  are number formulas evaluated as the action starts, with its `item`, `self`, `situational` and
  the character's fields (`max: effort.free`), and are type-checked at load (#111).
- a26226f: Engine errors carry the data their standard text names: `unknown-name` gives `name` (formula checks no longer give `id`), `unknown-function` gives `function`, `fieldOf()`'s `no-such-key` gives `key` and `family`, `unknown-reference` from actions gives `kind` and `id` (no more `followUp`, `pick` or `grant`), a scope-applied grant's preset choices give `id`, a reapply state key's `wrong-type` gives `target` (was `key`), and `offerFollowUp`'s `unknown-follow-up` gives `id` (was `followUp`). The formula error table says which data each code carries.
- a26226f: An overflow whose adjust on `into` would be clamped to no change (its target at its bound, nothing
  absorbed, no overflow of its own) no longer fires: the field clamps instead. Carried overflow
  stops cycling once its target is full, so more damage never leaves more health and large
  amounts no longer reach `maxOverflowChain` (#100).
- f44f66c: Creation docs say a creation action puts everything it decides on the sheet, its outcome being only a report, and that a random start leaves the player's words (string params, text input fields) blank. The conformance suite follows this round's fitd, Mörk Borg and Mothership pack fixes, with new cases for named factions at crew creation and a homebrew cohort's roll.
- f44f66c: Conformance suite: the `orc-create-character` case answers orc-2e's free boosts before the class's choices, as its guided start now asks them, and the `fate-mara` and `fate-extras` sheets no longer list fate-core's removed `teamwork` situational choice.

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
- 769fe80: A character `id`, its `links` values and a view's `id` may be up to 2048 characters, so a URL (IRI) can be a character's global ID across apps; a UUID stays fine for app-local IDs (#39). An object value under `extensions` may carry `$schema`, the URI of a JSON Schema the extending app publishes for its data; OCF doesn't host, fetch or check it, and other value shapes stay allowed (#40).

### Patch Changes

- 29398e1: Bring schema and data descriptions in line with the latest format features: kept-template queries that read the keeper, preset choices in computeSheet's choice list, and `grant`, `grants`, pick state and `preset-choice` in the change types; `.rolls` among roll results and `picksOf` in kept templates in the formula context.
- 44023e4: The action-run schema states the `auto` default for the `dice` and `choices` policies, and the docs no longer give `pause` as the `choices` default (#32).
- 7f34bf4: `renameState` with `item` no longer renames the key on every homebrew item: in the homebrew, and on saved copies, `renameState`, `removeState` and `moveState` with `item` apply to that item and homebrew items that extend it (with `type`, both must match). `renameChoice`'s `from` and `to` may be prefixed choice keys (`<qualified id>/<choice>`), moving a granted or template content's saved pick onto its owner's own choice. Upgrade docs and the upgrade schema describe every step parameter.
