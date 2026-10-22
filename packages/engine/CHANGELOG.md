# @opencharacter/engine

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
