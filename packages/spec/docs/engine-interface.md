# Engine interface

Every engine, the TypeScript reference engine and community ports alike, exposes the same calls. Ports may follow their own language's style (naming, exceptions, async), but the inputs and outputs are the JSON shapes in [`../schemas/engine/`](../schemas/engine/). Each call schema has `$defs/input` and `$defs/output`.

## Principles

- **Pure functions, except dice.** No memory between calls, no clock, no file or network access. The app loads packs and passes them in. Dice always go through the swappable dice function, so with a seeded dice function the whole engine gives the same output for the same input. applyChanges rolls only for incoming-change effects with dice, and writes the faces into the changes it returns, so replaying them never rolls.
- **Load once, call many times.** `loadRuleset` resolves inheritance, overrides, content-only queries and versions once. The app then passes the ruleset to every other call. The one load per character is its own homebrew, which every call that takes the character loads on top of the ruleset ([engine-core.md](engine-core.md#a-characters-homebrew)); engines may cache it.
- **Changes work like a reducer:** `(character, changes) → new character`, or an error. Apps don't edit character files directly. Actions return proposed changes that the app applies.
- **Errors are returned as data, never thrown.** Ports MAY turn them into exceptions where that is natural.
- **The engine never outputs display text**, only keys, codes and data. Apps build text keys
  from them ([i18n.md](i18n.md#key-conventions)); the reference helper `@opencharacter/text`
  does it for them, outside conformance (the
  [Showing text](../../../apps/website/guides/showing-text.md) guide).

## What apps own

The spec leaves these to the app. Packs give the app what it needs for each: an action to run, a field to show, a constraint that names what's missing.

- **The clock:** whose turn it is, rounds and initiative, the start and end of a turn, rests, dawn, and how many hours or days pass. Packs give an action for each point in time (a rest, a scene's end, a legendary-action reset, dawn); the app runs it when that time comes.
- **Money a pack doesn't track:** coins, prices and paying for things. A pack that tracks wealth does so with fields and actions.
- **Space and range:** zones, maps, distance, and who is within an aura's or a spell's area. An action's participants are whoever the app passes; packs give ranges and areas as data.
- **The GM's rulings:** who takes a consequence, and the order of rolls in an exchange. Actions take whoever the app names and an opposition as a parameter.
- **Creating and linking character files:** a new character needs an ID, storage and the player's say. Packs say when and what with a derived offer naming the empty link slot and the creation start that fills it (`create`); the app makes the file, runs the start and saves the link.
- **Running what the rules offer:** the engine lists follow-ups and stores the
  ephemeral ones in the file, but never runs or applies one, nor rolls outside an action. The app
  runs an offer, asks first, shows a derived offer later (its "not now"), or dismisses an
  ephemeral one.
- **Sheet layout and catalogs:** evaluating display hints (`members`, `showWhen`) and listing content that isn't a choice. Engines may offer helpers outside the spec.

## The calls

| Call             | Input                                                                                                                          | Output                                                                                                                                                                     | Schema                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `loadRuleset`    | pack releases in load order                                                                                                    | `{ ok: true, ruleset }` or `{ ok: false, errors }`                                                                                                                         | [load-ruleset](../schemas/engine/load-ruleset.schema.json)       |
| `computeSheet`   | ruleset, character, optional competing-option picks (a list of option IDs), optional `links`                                   | values with breakdowns, active effects, available actions, offered situational choices, pending choices, offers, competing options, rules issues, computed values per copy | [compute-sheet](../schemas/engine/compute-sheet.schema.json)     |
| `listOptions`    | ruleset, character, a choice path, optional `links`                                                                            | options, each with `eligible`, `picked`, `recommended` and `reasons`                                                                                                       | [list-options](../schemas/engine/list-options.schema.json)       |
| `applyChanges`   | ruleset, character, changes, `strict?`, optional `links`, optional dice function                                               | `{ ok: true, character, changes, issues }` or `{ ok: false, errors }`                                                                                                      | [apply-changes](../schemas/engine/apply-changes.schema.json)     |
| `startAction`    | ruleset, character, action (`id`, `entry?`), params, situational, policy, `links?`, `participants?`, `answers?`, dice function | finished, paused, or failure                                                                                                                                               | [start-action](../schemas/engine/start-action.schema.json)       |
| `continueAction` | ruleset, paused result, answer (`faces`, `option` or a handoff's `outcome`), policy                                            | finished, paused again, or failure                                                                                                                                         | [continue-action](../schemas/engine/continue-action.schema.json) |
| `upgrade`        | old ruleset, new ruleset, character                                                                                            | upgraded character, pending choices, "what changed" report                                                                                                                 | [upgrade](../schemas/engine/upgrade.schema.json)                 |

The ruleset's shape ([ruleset.schema.json](../schemas/engine/ruleset.schema.json)) is **PROVISIONAL**: only its top-level properties are fixed (`specVersion`, `packs`, `fields`, `contentTypes`, `content`, `rules`, `conflicts`). It is plain data, so apps can cache it or send it between machines running the same engine; another engine should rebuild it from the pack releases.

Besides these calls, `checkRelease` ([upgrades.md](upgrades.md#the-build-check), [check-release](../schemas/engine/check-release.schema.json)) compares two releases of a pack, each loaded with its dependencies. It is a build-time check for pack tooling, not a call apps make.

### computeSheet

- `values` maps each qualified field ID to `{ value, base, breakdown, tags? }`, `tags` the field's
  tags on the sheet, computed ones included. A field that cannot be computed (a loop) has `error`
  instead of `value`, and **everything else still calculates**.
- `effects` lists active effects; effects excluded by stacking have `suppressed: true`.
- `actions` lists the actions available now, with the entry each belongs to.
- `situational` lists the situational choices offered now.
- `pending` lists the choices that apply and still need picks: the open entries of `choices`.
- `offers` lists what the rules offer the character now: its stored ephemeral
  follow-ups (a concentration check after damage), then its derived offers (a level-up the
  experience has earned). Each is `{ id, kind, followUp, source?, to, character?, action?,
  params?, changes?, required, cause? }`; an app runs one with startAction and its `action`
  (which carries `followUp: <id>`), and dismisses only ephemeral ones
  ([engine-core.md](engine-core.md#the-offer-list)).
- `choices` lists every applicable choice, answered or not, in pending order,
  as `{ path, owner, id, slot?, min, max?, picks, open, preset? }`, inline options' and
  `activate: false` choices included; `preset: true` marks a choice a grant answers, which
  `choose` and `unchoose` refuse (`preset-choice`) ([engine-core.md](engine-core.md#the-choice-list)).
- `competing` lists competing options, one entry per competing group with its `op` and, for a stacking group, `stackKey` (see [effects.md](effects.md#competing-options)). The input's `competing` is a list of picked option IDs; each group applies its listed option, else its recommendation.
- `issues` lists rules issues.
- `copies` maps each copy's instance ID to its computed values (`{ <name>: value }`), for copies that have any.
- `copyNames` maps each copy's instance ID to its name from its state (`nameFrom`), for copies that have one; apps show it in place of the item's name.
- `templated` lists every item the character has with templates, as merged: each copy with a
  saved or kept template (`entry`), then each picked or granted item that content keeps
  templates on, as `{ entry?, item, templates, tags, fields }`, so an app shows the item as the
  rules read it ([engine-core.md](engine-core.md#merged-items)).
- `standardCopies` lists the character's standard copies, as
  `{ entry, item, saved }`: the rules' first, then those of active items, so an app can show the
  unsaved ones without running the queries. Each is also a copy in `inventory` or `features`.
- `activations` lists every content activation in instance order, each with
  its owner `entry`, how it was reached (`via`), `scope`, `parent` and, for a pick, its choice
  `path` ([engine-core.md](engine-core.md#the-activation-list)). A content group's `from: own`
  members are its holder activations of the group's type.
- `copyLimits` lists each content type with `copies`, in ruleset order, as `{ type, max, perItem,
  count, entries }` (`max` and `perItem` as declared, a formula's worked out), so an app shows
  Replace instead of Add ([engine-core.md](engine-core.md#copy-limits)).

### startAction and continueAction

- A paused result's `needs` names the step (`step`, its path) and the action that defines it
  (`action`, a qualified ID, `<item id>#<action id>` for an inline action). Every log entry has
  both too.
- A dice pause's `needs.summary` and every roll log entry's `summary` say what the roll is rolled
  against: the band set's bands that can still hold with their conditions
  resolved, structured `tests` and the running action's flags. An app previews a roll by
  starting the action with `dice: 'pause'` and reading `needs.summary`
  ([engine-actions.md](engine-actions.md#the-roll-summary)).
- A roll made more than once (advantage or disadvantage `of: roll`) pauses with `needs.repeat`
  (`{ times, keep }`) and `dice` for every roll in turn; its log entry lists every roll as
  `rolls`, the kept one marked, whose items are the entry's `items`
  ([engine-actions.md](engine-actions.md#rolling)).
- Each of a finished result's `proposedChanges` is `{ to, character?, step, change }`: `step` is
  the path of the `changes` step that proposed it. `to` is `self`, `target`, a role of the action
  or `{ link }` (a qualified slot ID). A change for a link carries the linked character's ID as
  `character`, and one for a role its participant's view `id`. The app applies each change to
  that character.
- `participants` passes the other characters taking part, by role the action
  declares: per role, a list of views `{ id, values }` taken from their own `computeSheet`, read
  like a link's. An undeclared role or a count outside the role's `min` and `max` is
  `invalid-participants`, a repeated ID `duplicate-id`, and a value of the wrong type
  `invalid-link-value`.
- A **handoff** pauses with `needs.kind: handoff`, the `participant` (`{ role, id }`) and `run`
  (`{ action, params }`): the app runs that action on the participant's own character and
  answers with its finished `outcome` (`{ result?, data? }`). A `result` the used action doesn't
  declare is `answer-mismatch`. The participant's own proposed changes and log stay with the app.
- An **allocation** pauses with `needs.kind: allocate` and
  `needs.allocate` (the offered fields with their values and limits, and the budget or the
  values); the app answers with `{ amounts }`, a map of field ID to amount.
- A paused action keeps the link views and participants it started with, so `continueAction`
  takes none.
- `answers` replays a list of answers, one per pause, each as continueAction
  takes it: the result is startAction then continueAction with each in turn. An answer that
  doesn't fit, or one left over once the action finishes, is `answer-mismatch` with
  `data.index` and, for a pause, `data.needs`. An app that can't trust a paused `state` from a
  client keeps only the answers ([engine-actions.md](engine-actions.md#replaying-from-answers)).
- An outcome `result` outside the action's declared `results` is `undeclared-result`.
- Text keys for prompts, parameters, rolls and results are built from `action` and the step's ID
  ([i18n.md](i18n.md#key-conventions)); the engine outputs none. Details are in
  [engine-actions.md](engine-actions.md).

### Links

`computeSheet`, `listOptions`, `applyChanges` and `startAction` take optional `links`: the views
of the characters filling the character's link slots, by qualified slot ID, each
`{ id, values }`. The app takes `values` from that character's own
`computeSheet` and may pass all of them; the engine reads only the declared fields. `upgrade`
takes none: it changes saved state only. See [engine-core.md](engine-core.md#links).

### listOptions

`listOptions` shows ineligible options **with their reasons** rather than leaving them out; the app decides whether to hide them, grey them out or allow them. **PROVISIONAL**, to be revisited once seen in practice. Each reason is exactly the rules issue `applyChanges` would report if the option were picked anyway.

## Three kinds of problem

| Kind              | When it's caught                                                                               | Example                                                                               | Result                                         |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Shape error**   | Before running, from the change's type ([`change.schema.json`](../schemas/change.schema.json)) | `equip` with no `entry`; a number where text belongs                                  | Rejected                                       |
| **Runtime error** | While applying, against the current character and ruleset                                      | equipping an item the character doesn't own; an unknown ID; Strength set to `"hello"` | Rejected; character unchanged                  |
| **Rules issue**   | After applying                                                                                 | a feat requires Str 13; too many attuned items                                        | Applied and reported (rejected in strict mode) |

A runtime error means the result would not be a valid character file. A rules issue means the file is valid, but the game's rules object.

- **Errors** ([`error.schema.json`](../schemas/engine/error.schema.json)): `{ code, path?, data? }`, where `code` comes from [`data/error-codes.json`](../data/error-codes.json). Each code has a `kind`: `shape`, `runtime`, `load` or `action`.
- **Rules issues** ([`rules-issue.schema.json`](../schemas/engine/rules-issue.schema.json)): `{ code, id?, source?, data? }`, where `code` comes from [`data/rules-issue-codes.json`](../data/rules-issue-codes.json). `id` is the qualified pack-defined prerequisite or constraint ID.
- **Strict mode** (`strict: true` on `applyChanges`) turns rules issues into a runtime error (`rules-issue`, with the issues attached). Rules issues don't block by default because homebrew tables bend rules on purpose.
- The spec ships standard English text for every code in [`../i18n/en.yaml`](../i18n/en.yaml) (`errors.<code>`, `issues.<code>`), exported as `@opencharacter/spec/i18n/en` (JavaScript and JSON; [i18n.md](i18n.md#engine-output)).

## Changes

The change types are a small, generic, fixed set ([data](../data/change-types.json)): `set`, `adjust`, `addItem`, `removeItem`, `equip`, `setState`, `adjustState`, `setQuantity`, `adjustQuantity`, `applyTemplate`, `removeTemplate`, `applyEffect`, `removeEffect`, `toggleEffect`, `choose`, `unchoose`, `setExtension`, `finishCreation`, `setHomebrew`, `dismissFollowUp`, `clearFollowUp` and `offerFollowUp`.

- **Batches are all or nothing.** A level-up of eight changes either fully applies or doesn't apply at all.
- **Same changes, same result.** Replaying a character's change list from the start always rebuilds the same character, which gives apps undo, history and multiplayer sync.
- **Apps log the output's `changes`, not their input.** It is the batch as applied: an `adjust` whose incoming-change effects rolled dice (MÖRK BORG armor) carries the faces it used in `faces`, so a replay reads them back and never rolls. Without faces or a dice function such a batch is rejected with `faces-required`, listing the dice to roll; the app can roll them and resend the batch with `faces` ([engine-core.md](engine-core.md#dice-on-incoming-changes)).
- An `adjust` change with `tags` passes through the character's incoming-change effects first (resistance halves tagged fire damage), then through absorbing fields and overflow ([rules-and-fields.md](rules-and-fields.md#absorbing-and-overflow)). The output's `adjustments` lists what each adjust actually did to each field, then what an incoming-change effect's `then` did to its own entry: a state change, or `removed: true` when it ended its applied entry.
- An `on` or `becomes` follow-up the batch triggers (a concentration check after damage, a death save at maximum wounds) is stored in the returned character's `followUps`, and the output's `followUps` lists the ones this batch stored, as computeSheet's `offers` does. applyChanges never runs or applies them; the app decides ([engine-core.md](engine-core.md#follow-ups)). `dismissFollowUp` deletes one unrun; `clearFollowUp`, which startAction proposes for a run that takes one up, deletes it when the run's changes are applied.
- `unchoose` removes the option's nested picks in the same change. Without `option` it removes every
  pick of the choice, with their nested picks; a choice with none is left unchanged, so a batch can
  clear a choice and pick again without knowing what it held.
- `finishCreation` clears the character's `creating`. It is rejected with
  `creation-incomplete` while the character has rules issues or pending choices, which the
  failed result lists as `issues` (pending choices as `too-few-picks`).
- `setHomebrew` replaces the character's own homebrew, or removes it
  with `null`; later changes in the batch see the new one
  ([engine-core.md](engine-core.md#applychanges)). Actions can't propose it.
- `setQuantity` and `adjustQuantity` change a copy's `quantity` (spending an arrow, buying ten more). It never goes below 0, and a copy at 0 stays: removing it is a separate `removeItem`.
- `setState`, `adjustState`, `setQuantity`, `adjustQuantity`, `equip` and `removeItem` may name their copies with a query (`copies: { type, where }`) instead of one `entry`. The receiving character resolves it, so an action can aim one at its target's copies ([engine-core.md](engine-core.md#applychanges)).
- `applyEffect` may leave out `id`, and `removeEffect`, `toggleEffect`, `setState` and `adjustState` may name applied entries with a query (`applied: { where, limit? }`). The receiving character picks the ID and resolves the query, so an action can apply a condition to its target, or end or worsen one, without knowing the target's file ([engine-core.md](engine-core.md#applychanges)).
- `setState` and `adjustState` also change a pick's state (`path` and `option`, or `picks: { where }`) and the saved state of content a holder grant makes active (`grant` beside the copy's `entry` or the pick's `path` and `option`, or `grants: { where }`); a grant not active there is `not-granted` ([engine-core.md](engine-core.md#applychanges)).

**Typing at two levels.** The change itself is checked against the spec's JSON Schema. What's inside it (does `abilities.str.score` exist; is 25 within its range) is defined by the ruleset and checked at runtime. Tooling can generate game-specific types (TypeScript, JSON Schema) from a ruleset, so an app built for one game catches most runtime errors before anything runs.

## Safety

Engines enforce the [safety limits](../data/safety-limits.json) and report `safety-limit-exceeded` instead of hanging or exhausting memory.
