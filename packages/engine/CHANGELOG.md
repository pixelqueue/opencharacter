# @opencharacter/engine

## 0.4.0

### Minor Changes

- c89c541: Content extends a shared action per item (#194):

  - A `use` entry may have its own `available`, ANDed with the used action's and evaluated with
    the listing's `item` and `self`: a condition's saving throw only while it is "save ends".
  - An action's `tags` may hold `{ formula }` entries, evaluated per listing with its `item` and
    `self`; computeSheet's listing (display groups), describeAction and `params` effects see them.
  - A new effect op, `params`, on a new target, `{ actions: [<tag>], from? }`, adds parameters to
    the listed actions whose tags match while its `when` holds: an ability's damage type chosen
    on each use, a feature's opt-in on a rules action. startAction checks them as the action's
    own (their errors carry `addedBy`), describeAction lists them after the action's own with
    `addedBy`, and content reads them as `params.<name>` in its effects. Their text is
    `<content key>.params.<name>.name`; the text package adds `addedParam`,
    `addedParamDescription`, `addedParamValue` and the keys `addedParamKey` and
    `addedParamValueKey`, and names a parameter error by `addedBy`. Each added parameter is
    optional or defaulted and reaches only the run the app starts (not a nested `action` step's);
    a required one, a name an action the effect's tags reach declares, or two effects declaring
    one name differently over tags that meet are the new load error `invalid-added-param`. Its
    `min` and `max` see the effect's roots; a `use` may fix it.
  - startAction and describeAction read the `use` computeSheet lists (the first available one
    with the ID), and evaluate its fixed `params` in the pack that writes the use.

- c09dbbb: Two conditions that read the computed sheet beside activation (#232, #234).

  A grant may say `available`: a condition evaluated on the computed sheet (derived fields bound,
  `self`, `item`, `x` and `i` as in its `when`), ANDed into the `available` of every action the
  granted content offers and of the content it grants or picks in turn. The content stays active
  and listed; computeSheet's `activations` marks it `unavailable: true` while the condition fails,
  its actions aren't listed, startAction refuses them (`unknown-action`), follow-ups don't offer
  them, and it declares no follow-ups and projects no auras. So a Draw Steel treasure grants its ability only with a matching kit.

  A content type, or an item in place of its type's, may say `effectsWhen`: a condition ANDed into
  the `when` of every holder effect of its items (the type's, the item's own, its choices' and
  inline options', on fields, rolls, steps, params and incoming changes) and its holder auras'
  `when`, evaluated as the effect's `when` is. `scope: applied` effects and auras, whose `self` is
  the entry, don't read it. `true` on an item lifts the type's. So 5E's attunement or ORC's
  investment is written once on the type. Neither condition decides activation, so neither can
  loop back into it; a loop through `effectsWhen` is `circular-formula`, as through a `when`.
  Conformance suite: `sheets/grant-available`, `sheets/grant-available-met`,
  `sheets/effects-when`, `sheets/effects-when-met`, `sheets/effects-when-circular`,
  `sheets/effects-when-applied`, `changes/grant-available-follow-up`,
  `actions/effects-when-roll`, `actions/grant-available-start`, `loads/activation-gate-checks`.

- 66e21e3: A `params` effect may add bounds to a parameter the run already has: an entry with only `min`
  and/or `max` (no `type`) bounds the action's own parameter, or one another effect adds, instead
  of declaring it. Every bound must hold; the `out-of-range` error names that parameter, with the
  failing bound's `min` and `max` and `boundBy`, the content that added it. describeAction lists
  them under the parameter's `addedBounds`. Two bounds on one name don't conflict; a bound on a
  name no action declares and no effect adds is `invalid-added-param` (reason `undeclared`). So
  Healing Grace's enhancements bound the ability's own `spend`, and an overspend names `spend`
  (#252).
- 2b5c337: `invalid-added-param` (`conflict`) follows the effects again, not only the actions loaded so far
  (#222). Two `params` effects adding one name with other declarations conflict when their target
  tags meet (one is the other or below it) and their packs meet over that tag, or when one action's
  literal tags reach both. So two add-ons of one core, or two effects of one pack whose action gets
  the tag only from a formula, are rejected again (#224 accepted them when no loaded action carried
  the tag literally); an unrelated game loaded beside them, or a pack depending on two games, still
  never clashes. Two `from: self` effects carried by different content items don't conflict, so
  each spell may declare its own values for one `damageType` parameter on the shared cast action,
  unless one item names both (itself, its `grants`, its choices' `items` and inline options) and has
  an action, its own or its type's, that both reach: its copy's own run takes both. A
  breaking change for packs that declared one name otherwise over tags that meet.
- 4824a5a: An `adjust` may carry `from`, the ID of the character whose action or follow-up sent it. Actions
  fill it in on every adjust they propose for another character (`to` a role, `target`, a link or
  `applied`; not one for the actor's own view in a role), and follow-ups on every adjust for another character; changes `to: self` carry none.
  Its field entries keep it: an `on` follow-up reads it as `change.from` (`''` when none) and
  stores it in its `cause`, and `batch.adjustments` entries have it. Expected proposed changes in
  the conformance cases now include it (#187).
- d698709: applyChanges rejects an adjust whose tag no loaded pack declares: `unknown-tag` (data: `tag`,
  path `/changes/<index>`), the batch unapplied. Before, the change applied and the tag matched
  nothing, so a misspelled or qualified tag (`<pack>:damage.fire`; tags are never qualified)
  silently fired no incoming effect or follow-up (#186).
  An app applying changes to a linked character must load a ruleset that declares the tags it
  sends.
- 4824a5a: A proposed `applyEffect` may name its applier with an `appliedBy` formula giving a character ID,
  usually a participant's (`participants.ally[0].id`: frightened of the ally who triggered it);
  without one it is the actor, as before. A value that isn't a non-empty string is `type-mismatch`.
  Everything that reads the applier follows the named character, so the actor's own changes
  `to: applied` no longer reach the entry (#236).
- 5d33422: Applied entries record who applied them: `appliedBy`, the applier's character ID (optional, so
  saved entries without it stay valid). Every `applyEffect` an action or follow-up proposes carries
  the actor's ID; formulas read it as `self.appliedBy` and in `character.applied`. An applied query
  may keep to one applier's entries (`applied.appliedBy`; `appliedBy: self` in a proposed change).
  A step, option, added changes, roll effect `then` or follow-up may send changes `to: applied`:
  every character holding an entry the actor applied. Each is proposed once with no `character`,
  its query limited to the actor's entries, for the app to apply to every character that may hold
  one; anything but a removeEffect, toggleEffect, setState or adjustState naming applied entries by
  query is `invalid-applied-change` at load, as are a follow-up `to: applied` without `changes` and
  a role named `applied`. The app applies a run's changes in the order proposed, across characters. `reapply` gives a merged entry the new applier, and
  `match: [appliedBy]` keeps one entry per applier (#187).
- 0f1fa68: Auras from casts, and auras that grant immunity.

  - An aura may say `scope: applied` (#229): it is projected by applied entries of its item instead
    of by the held item. computeSheet lists it once per active, unblocked applied entry the
    character applied itself (no `appliedBy`, or its own `id`), with `entry` that entry's ID, and
    its `when` and `size` see the entry as `self`. So one cast is one aura, whatever it was cast
    from, sized by the cast's own state, and it leaves `auras` when the entry ends.
  - Content an applied grant reaches sees its own declared state defaults in `self` for keys the
    granting entry lacks.
  - An aura whose `when` or `size` fails is left out of `auras` with the formula's error, no longer
    silently.
  - An aura may declare `immuneTo` (#227), the immunities of its entry: a matching applied entry on
    whoever is inside is blocked and reported `immune` with the ID `<item>#<aura>/<id>`. Its `when`
    and query `where` see `item`, `self` and `applier`. A `scope` other than `applied` on one is
    `invalid-aura`, as is an aura with neither `effects` nor `immuneTo`.

- 5d33422: Content items may declare `auras`: areas whose effects are on whoever is inside (`{ id, when?,
  size?, affects?, fields?, effects }`). computeSheet lists the auras the character projects now
  (`auras`: `{ source, aura, entry?, size?, affects }`); the app applies the aura's entry to each
  creature inside (`applyEffect` with `aura` and `appliedBy`) and removes it as they leave. An aura
  entry runs only its aura's effects (none of its source's rules for the holder: effects, grants,
  actions, prerequisites, immunities, standard copies, kept templates) and is one per applier;
  they read the holder's live values as `applier.<field>` from
  the view the app passes in the new `appliers` input of computeSheet, listOptions, applyChanges,
  startAction and describeAction (declared defaults without one; a paused action keeps them; a
  repeated view `id` is `duplicate-id`). A repeated aura ID or an aura effect on its holder is
  `invalid-aura` at load, a declared field the item's pack lacks or types otherwise
  `link-field-mismatch`; an unknown `aura` is `unknown-id`. `appliedBy` is a reserved state key
  name (#188).
- 766416f: Choices whose picks wake on a condition or come as copies (#196). `activeWhen` on a choice, an
  activation condition, keeps its picks saved and counted while it fails, but neither activated
  nor applied (its `effects` don't run either); computeSheet's choice list marks the choice
  `inactive: true`. `addAs: copy` on a content choice holds each pick as a copy of its own:
  `choose` adds the copy as `addItem` would (under the option's derived ID, or the next free one)
  and saves its instance ID on the pick (`entry`, a new optional key of a saved pick); removing the
  pick, or what holds it, removes the copy, and `removeItem` of the copy is the new runtime error
  `picked-copy` (data: `entry`, `path`; standard text in `i18n/en.yaml`). The pick itself activates
  nothing, so the item applies once, through its copy; `listOptions` checks its prerequisites as
  that copy's. `pnpm validate` reports `addAs` on a choice of values or inline options.
- 766416f: Choice picks held as copies, tightened (#195, #196). A choice's `recommend` no longer sees its
  own picks in `options`, so `options[0]` is the next to pick. A pick's copy is added under the
  option's derived ID plus `_pick`, which no standard copy can have, and `adoptStandard` and the
  standard-copy cleanup leave copies picks name alone. Saved copy links are checked: a missing
  or dangling link, one to another item's entry, one an earlier pick names, or `entry` on a
  choice without `addAs` is the new rules issue `picked-copy-invalid` (data `problem`), and only
  links that hold count for `picked-copy` and for removal with the pick. Upgrade steps that remove
  a pick remove its copy too. Grant-only content is `option-not-eligible` in an `addAs: copy`
  choice; `addAs` with `waivePrerequisites` is a schema error, and `pnpm validate` reports a grant
  presetting such a choice and warns on `activeWhen` with `activate: false`. Below a failing
  `activeWhen`, the picks' own choices are still listed and asked, inactive too. `checkRelease`
  reports a choice gaining or losing `addAs` as the interface change `choice-copies-changed`.
- 766416f: Recommendations that follow the character (#195). A declared choice's `recommend` sees
  `options`: the options it offers that are eligible apart from prerequisites (in `from` and its
  `where`, passing `eligible`, not taken elsewhere in its `unique` group), in the order offered, so
  a choice whose options depend on the character recommends one (`options[0]`) and guided and
  random starts over pending choices don't stop there. An allocate step's `recommend` may be one
  formula, evaluated per offered field with `field` bound (`{ id, value }`), giving its amount or
  `null` for none; and a `recommend` map's entries for fields the step doesn't offer are now
  ignored instead of making the recommendation invalid, so one step recommends for whichever
  fields its query offers.
- 5a70646: Picked and granted content has computed values: its type's, item's and kept templates' `computed`
  are worked out per activation after every field, reading derived fields and the owning copy (with
  its computed values). computeSheet lists them in `activationValues` (`{ activation, values }`),
  and the content's actions and follow-ups read them as `self.<name>`. A template kept on content
  without a copy may now give computed values. An item's description and named texts take a
  block's arguments, so `{self_<name>}` fills them from those values: `contentCard` fills the
  description, the new `contentText` gives a description or named text filled, headline pieces of
  picked content read `activationValues`, and `pnpm validate` checks their arguments (#193).
- ec9726a: A content display group with a member other than a standard copy is shown whatever its `showWhen`, so held content never disappears (a spell added from the catalog to a cwn-srd character who isn't a caster) (#175).
- 66e21e3: Derived parameters: an action parameter (its own, or one a `params` effect adds) may declare a
  `formula` instead of being given. startAction works it out once every given parameter has its
  value and before any bound, in declaration order, reading the given parameters and the derived
  ones before it (a later one is `unknown-name` at load, so they can't loop), and the run's
  `participants`, now checked before the parameters (their errors come first). Everything reads it
  as `params.<name>`. A value for it from the app, a `use`, an `action` step or a handoff is the new
  error `invalid-param` (reason `derived`); the build reports a `use`'s, a creation start's, a
  field roll's, an `action` step's and an `action` effect's. describeAction lists it with
  `derived: true`.

  Effects that act as an action runs (on rolls, choice and changes steps, listed actions and
  incoming changes) read their content's computed values as `self.<name>`, as its actions do. A
  field effect still can't (`unknown-name` at load): computed values are worked out after every
  field, so one feeding a field could loop. So Cunning Strike's cost is worked out once, and its
  DC is a computed value its strike effects read (#251).

- d698709: `from: self` on a roll, choice-step or changes-step effect names the content the action runs
  for: besides the copy being the action's entry, an action run for content granted or picked
  under the copy (named by `source`) matches only the effects that content carries. Abilities a
  class grants that share their content type's action now each add only to their own runs;
  before, every ability on the copy matched, so one ability's bonus reached another's rolls
  (#199). So an effect on the copy's own item (a class) or in a choice's own `effects` no longer
  reaches the actions of content granted or picked under it. A template is part of its copy: its
  own action still matches by entry, so the copy's item, type and other templates reach it.
- 766416f: Inline options as content items (#195): an inline option may have an optional description,
  `<owner>.choices.<choice>.options.<id>.description` (Markdown), so a random table of named
  paragraphs is a choice of inline options, and `createText`'s new `optionDescription(choice, id)`
  reads it (from the adding pack for an option `extendChoices` added). An inline option takes
  `immuneTo`, held while it is picked and active; the `immune` issue's `id` is the option's source
  ID plus the immunity's (`<owner>/<choice>/<option>/<id>`).
- a627c9d: The list functions (`countList` … `sortList`) bind `i`, the element's position in the list, an
  int from 0. A skipped null element keeps its place, so `i` pairs an `each` step's
  per-participant results and flags with `participants.<role>`
  (`mapList(steps.tier, participants.target[i].id)`). A proposed change or a grant with `forEach`
  binds `i` too, beside `x`. `i` is a context root, so a field ID's first segment can't be `i`, as
  it can't be any root's name (`x`, `item`, …) (#192).
- 52f032a: A `list` item field may hold whole numbers, `of: integer` (#211): its value is a list of
  integers, checked at load and per copy (`invalid-item-field` / `wrong-type`), and formulas read it
  as `list<int>`. So content carries a table of numbers: a class's characteristic array, a point-buy
  cost table, a per-level bonus. `of: integer` is for a `list` only, and `integer` joins the reserved
  content type names.
- 4824a5a: Follow-ups can react to another character's events. A successful applyChanges that made field entries (adjusted a
  field) returns `observe`: an `observe` change naming the character, its field entries (with tags
  and who sent them) and the applied entries it held that name an applier. Applied to another
  character, the new `observe` change changes nothing but fires its `on` follow-ups with `from`:
  `any` (any other character), `applied` (one holding an entry this character applied) or
  `{ link }` (the character filling a slot); `change.character` and `change.applied` name the
  observed character and the content it holds from this one. computeSheet lists the fields such
  follow-ups watch in `observes`, so an app routes `observe` only where it matters; an app that
  doesn't route events loses only these reactions. A follow-up may also be `to: character`, for the
  character whose ID its `character` formula gives (`change.from`): stored and listed here with the
  ID in `character`, its changes resolved in this pack's scope (#187).
- 766b5de: A parameter's `min` and `max`, an action's own and those a `params` effect adds, see `params`:
  startAction checks every bound once every parameter has its value (the app's, a `use`'s fixed
  one, or the default), so one parameter bounds another (Healing Grace's enhancements up to the
  Spend: `max: params.spend - (params.graceStand ? 1 : 0)`). describeAction leaves out a bound that
  reads `params` (#235).
- a627c9d: Per-target edges and banes, a roll's effective total, and minimum tiers (#190, #192):

  - A roll's `atLeast` and `atMost` on its tallies and on its band value hold whenever it is
    classified again (`of`): before, a minimum tier or a tally cap was lost on the per-target
    bands.
  - A roll step that classifies an earlier roll again (`of`) may carry `tags` of its own. The roll
    effects matching them work out its tallies and bounds again from the earlier roll's, in the
    step's context (`participant` bound in an `each` step), so what one target brings to a roll
    (an edge against a prone or winded target) reaches only that target's band, and the roll's
    tally bound (ignoring banes) applies after it. Their `then` is proposed as on a roll step. The
    log entry lists the step's `tallies` and own `bounds`. Effects that add items or dice don't
    apply there, so per-target advantage isn't covered.
  - A band set may give `total`, the roll's effective total: evaluated first, it becomes the
    step's `total` (and `roll.total` for the set's `value` and bands), so a roll with an edge
    reports 15, not 13. The total before it is the new `steps.<id>.bounded`, and the log entry's
    `bounded` when they differ. A set needs `value`, `total` or both.
  - `atLeast` and `atMost` roll effects aimed at a band set's value (`target: { rolls, band:
    value }`) bound a numeric `value` before the bands read it: a minimum tier. The log entry lists
    them in `bandBounds`. `pnpm validate` warns when a matching roll's band set has no `value`.

  The docs also show costs that depend on the roll: a `changes` step after it, with `available`
  reading the lowest cost and an `outcome` step ending an action whose cost can't be paid (after
  the roll's dice and its effects' `then`).

- 852f9dd: `poolDice` roll modifiers stack by key (#214): those on one part are grouped by `stackKey` and
  reduced by the key's policy, compared by `count`, as `stepDie` modifiers are by `steps`. Under
  `highestOnly` only the largest pool counts, so Sine Nomine's skill dice from two foci no longer
  add up. A pack whose keyed pool dice used a non-`addAll` policy now rolls fewer dice.
- 852f9dd: Paying to improve a finished roll (part of #192): a choice step's `recommend` may name `#done`
  while it is offered, so declining is the default and an automatic run doesn't pause on a step
  offering only added options; a written option list may be empty (`options: []`), so such a step
  offers only what `option` effects add and is skipped when nothing does. The docs show the
  pattern: a tagged step after the roll where content (Draw Steel's Brawny, PF2e's Hero Points,
  5E's Lucky) adds a paid option that sets a flag the outcome reads.

  Steps that already said `recommend: "'#done'"` now decline under an automatic policy instead of
  pausing: orc-sf-2e's Re-forge Solar Weapon takes no traits unless the app asks (intended: it
  recommends none). Over pending choices `#done` is still never recommended; `pnpm validate` warns
  about a `recommend` naming `#done` on a step that never offers it.

- 8a898a7: `checkRelease` reports more interface changes, each needing a breaking bump (#220):
  `param-removed` and `param-type-changed` (an action parameter removed, retyped, losing enum
  values or becoming required, on a rules action, an item's or a content type's inline action, or
  added by a `params` effect), `situational-removed` and `situational-type-changed`, and
  `action-removed` now also covers an inline action or `use` gone from a remaining item or content
  type. upgrades.md says a narrowed `available`, `when`, target, bound, `where` or tag `members`
  can't be compared statically and needs a breaking bump from the author.
- 852f9dd: A `tag` roll effect adds tags to a roll's own parts (#212):
  `{ target: { rolls, parts }, op: tag, value: [<tags>] }`, entries may be formulas. It applies
  after replaced parts and before anything else reads the roll, so content types a part a shared
  action builds from the item's own fields (Draw Steel's Dragon Breath and Hurl Element, a damage
  type chosen on each use), and later part targets, a `split` and incoming-change effects see the
  new tags. Every active `tag` effect counts; it takes no `stackKey`. `pnpm validate` checks its
  literal tags.

  `loadRuleset` reports a literal tag in a `tag` effect that no visible pack declares as
  `unknown-tag`.

- 52f032a: A rules-level choice's issue IDs name its pack (#213): `choice-not-applicable`, `too-many-picks`,
  `too-few-picks`, `option-not-eligible`, `already-picked`, `no-eligible-option` and
  `picked-copy-invalid` carry `<pack>:rules/<choice>` (was `rules/<choice>`), the owner as
  `needs.choice.owner` names it, and an inline option of a rules-level choice has the source ID
  `<pack>:rules/<choice>/<option>`, so its prerequisite, immunity and nested choice IDs are
  qualified too. Competing-option IDs move with them: a rules-level choice's own effects are
  `<pack>:rules/<choice>#<pick>/<effect>` (was `rules/<choice>#…`) and its inline options'
  `<pack>:rules/<choice>/<option>#<effect>` (orc-2e's `qi-tradition`:
  `orc-2e:rules/qi-tradition/divine#0`), so an app re-keys the competing picks it saved (in
  `extensions`) under the old IDs. `@opencharacter/text` reads the choice's prompt from the pack the ID names instead of
  searching the loaded packs. A breaking change for an app that keys on `rules/<choice>`.
- 489b687: A situational choice on incoming changes may be `scope: batch`: selected on one adjust, its
  incoming-change effects reach that adjust and every later adjust of the batch its `incoming`
  matches, and each `add` among them is worked out once (dice rolled once, the faces on the adjust
  that rolled) and spent toward 0 over the changes in order, what one doesn't take carrying to the
  next: an attack's total damage reduced once. Selecting it on a second change of the batch is
  `situational-unavailable`. Incoming-change effects now see `batch`, whose entries gain `taken`,
  and their `then` sees `incoming.taken` (the amount after every incoming-change effect) and
  `incoming.rolled` (the effect's own dice total). Making an existing choice batch-scoped changes
  how logged batches replay: a breaking bump for the pack (#215).
- bc91814: A situational choice's `changes` may `setState` or `adjustState` held copies, named by a
  `copies: { type, where }` query with an optional `limit`, as a change aimed at copies is. They
  apply once per batch with the choice's other changes, after the batch's last change; `where`,
  `value` and `by` are evaluated per matched copy with `item`, `self`, `situational` and `batch`
  bound, in the choice's pack, and each match is checked as a `setState` or `adjustState` naming
  it. Their `{ copies }` entry in `adjustments` carries the choice as `source`. At load, a state
  change without `copies`, a key the content type doesn't declare (or an `adjustState` of a non-numeric one) is
  `invalid-situational-change`, and an unknown content type is `unknown-reference`. Shield Block
  can now reduce a whole attack by the shield's hardness once and give the shield the rest (#244).
- 489b687: A situational choice on incoming changes may declare `changes`, what choosing it costs or gains:
  `set` and `adjust` of the character's input fields and `offerFollowUp` of a rules follow-up, each
  with an optional `when`. applyChanges applies them once per batch that selects the choice, however
  many of its changes do, after the batch's last change; their formulas see the character as the
  batch left it, `situational` and `batch`. Their adjusts skip incoming-change effects and clamp as
  any adjust, and the `requested` entry in `adjustments` carries the choice as `source`. The
  returned `changes` don't list them: the selecting change brings them back on replay, so a log
  replays batch by batch. A choice with `changes` selected at two values in one batch is
  `situational-unavailable`. At load, a follow-up the rules don't declare is `unknown-reference`
  (kind `follow-up`); a derived or non-numeric field, or a follow-up parameter its action doesn't
  take, is the new `invalid-situational-change`; an undeclared tag is `unknown-tag`. Adding or
  changing an existing choice's `changes` changes how logged batches replay: a breaking bump for
  the pack (#192).
- 5a70646: A stack key may span fields: `settings.stacking.keys.<key>: { policy, spansFields: true, score? }`
  groups the key's effects of one op on every field and keeps one source for all of them, by its
  score (`sum`, or `{ field }`). `playerChooses` reports it as one `competing` entry with `fields`,
  one option per source with its score as `value` and its value per field as `values`; picking it
  applies the source on every field. A Draw Steel kit's bonus across three tiers is one bonus
  (#197). A score field none of the key's effects targets is the load error `invalid-stacking`. Keys
  declared as a plain policy behave as before.
- 766b5de: A new effect operation, `action`, on a tagged changes step (`target: { steps: [<tag>] }`) runs a
  rules action there, as an `action` step would, after the step's changes: `{ id, use, params?,
  participants?, each?, as?, changes?, to? }`. Per participant of `each` (the current one in an
  `each` step), and with `as: participant` handed off, so a feature adds the target's saving throw
  to a shared attack; each effect runs its own, so one hit carries two saves at their own DCs. Its
  `changes` follow and read the run's outcome as `run` (a new formula root, also substituted in
  formulas a change passes on). The run's path is `<step path>/<content id>#<id>`, `[<i>]` per
  participant. Field IDs may no longer start with `run` (#228).
- c89c541: A `changes` effect on a tagged changes step may set the action's flags (`value.flags`, only
  flags the action sets elsewhere, checked at load as an added option's), before the step's own
  changes and per participant in an `each` step, so content adds to what a shared action works out
  (forced movement) or turns off one of its changes ("instead"). Its changes may come first, with
  `order: before`, so a gain counts before the step's own spending clamps the field. A proposed
  change's `by` that gives dice is rolled by the action: a dice checkpoint at the step matched by
  the change's tags, logged with its `faces`, `dice`, `total`, and the change's `tags` and
  `field`, which a pause also puts on each die it asks for (#191).
- 205adc0: Tag targets reach only related packs (#217). Tags aren't qualified, so unrelated games loaded in
  one ruleset (the `@opencharacter/packs` bundle, a homebrew mixing games) may share one. An
  effect's roll, choice-step, changes-step and action (`params`) targets, and a situational
  choice's roll effects, now reach an action only when the pack that wrote the action and the
  effect's pack meet over the target tag: their scopes (each pack with its dependencies) share a
  pack that declares it. An add-on and its core reach each other's tagged actions, as do two
  add-ons of one core and the homebrew; an unrelated game never does, and a shared base pack
  connects games only over the tags it declares. An action counts by the pack that wrote it (a
  content type's action on a homebrew item is the type's pack's). A `fields` query reaches only
  fields of packs whose scopes share a pack with the effect's. The load error
  `invalid-added-param` uses the same scope: `declared` counts only actions the effect reaches,
  and `conflict` needs one action both effects may reach. Incoming changes carry no pack and stay
  unscoped. The ruleset's `packs` entries list each pack's own declared `tags`.
- 5d33422: A rules action may declare `clock: turn-boundary`: the app runs it on every character in the
  encounter at each turn change, with `params.ended` and `params.started` the IDs of the characters
  whose turn ended and starts. It must run with nothing the app makes up and never pause (every
  parameter defaulted or `optional`, `ended` and `started` strings, no role with a minimum, listed,
  no choice, allocate or handoff step in it or a rules action it runs, never on content;
  `invalid-clock-action` at load), and computeSheet lists it with its `clock`. Content resets
  turn-scoped accumulators through its tagged steps and ends what the creature whose turn starts
  applied until then (`self.appliedBy == params.started`) (#198, #187).
- 52f032a: A proposed `unchoose` may name a content's choice by its owner, `choice: { owner, id }`, instead of
  `path` (#233): it clears the choice on every activation of the content, as `picksOf(owner, id)`
  reads them, proposed as one path-form `unchoose` per activation whose choice has picks. `owner` is
  `self` (the content carrying the effect that adds the change, else the action's or follow-up's
  content) or a content ID. Only for the actor's own choices. So content picked anywhere in the
  choices tree resets its own pick from a step (Draw Steel's Eidetic Memory at a respite). Apps still
  receive path-form unchooses only.
- 8a898a7: A situational choice the app gives that the ruleset doesn't declare is now the error
  `unknown-situational` (data `situational`) instead of being ignored: in startAction's
  `situational` (an action error), and in an `adjust`'s `situational` in applyChanges (a runtime
  error that rejects the batch; it was `unknown-id`) (#220). Apps must drop situational IDs
  computeSheet no longer offers, for example after a pack update removes a choice, or the call
  fails. A paused action resumed against a newer release is checked again the same way, so one
  selecting a removed choice fails with `unknown-situational`: start it again.
- 2ed1d82: Two upgrade steps (#200). `grantsToCopies` (`item?`, `type?`) turns content a copy's item or type
  granted it directly, and no longer grants, into copies of their own right after it, with the
  grants' saved state, `state` values, picks and the saved state of what they grant in turn. It
  reads old IDs through the script's renames, handles each holder's grants once per upgrade, and
  reports content it can't copy as `grant-not-copied` in the upgrade report's `errors`.
  `changeContentType` (`id`, `from`, `to`) covers an item's `content-type-changed`: its copies move
  to the list the new type keeps them in, lose `equipped` where it isn't equippable, and keep the
  state keys the item declares now. checkRelease reports a new shape change, `grant-removed` (a
  remaining item stops granting content it granted, covered by `grantsToCopies` or
  `removeContent`), and `upgrade-step-mismatch` for a `changeContentType` whose types aren't the
  item's.

### Patch Changes

- d698709: A view-field set's family keys expand where the set is declared, so a content action's
  participant role that names the set gets the expanded fields, as a rules action's role does.
  Before, the role kept the unexpanded keys and loadRuleset failed with `unknown-name` on a formula
  reading one (#183).
- 9b7b570: loadRuleset reports `duplicate-content-id` (data `id`, `pack`) when two content items of one
  pack share an ID, instead of keeping the last silently.
- 83158af: Actions run several times faster: the rules actions content names with `use` are found once per ruleset, and an action reuses the actor's sheet across its start and resumes instead of rebuilding it each time. What a run returns is its own copy, so a caller editing a result can't change a later run. No answer changes.
- 4be76a3: The README lists `describeAction`, the export calls and the `spec` type namespace, says which calls take `links` and `appliers`, and describes the caches an action run keeps.
- d698709: An offered follow-up that the content adding the option or changes doesn't declare (nor its
  content type) falls back to the content defining the action, then to the rules, as the spec
  says: content adding to a rules action's tagged step can offer the rules' follow-up. Before,
  it was `unknown-reference` (#184).
- Updated dependencies [71a3eb6]
- Updated dependencies [53c36f2]
- Updated dependencies [53c36f2]
- Updated dependencies [53c36f2]
- Updated dependencies [769efe5]
- Updated dependencies [769efe5]
- Updated dependencies [769efe5]
- Updated dependencies [769efe5]
- Updated dependencies [53c36f2]
- Updated dependencies [71a3eb6]
- Updated dependencies [71a3eb6]
- Updated dependencies [71a3eb6]
- Updated dependencies [53c36f2]
- Updated dependencies [53c36f2]
- Updated dependencies [53c36f2]
- Updated dependencies [71a3eb6]
- Updated dependencies [53c36f2]
- Updated dependencies [53c36f2]
- Updated dependencies [53c36f2]
- Updated dependencies [bf23fd5]
- Updated dependencies [ec9726a]
- Updated dependencies [71a3eb6]
- Updated dependencies [53c36f2]
- Updated dependencies [53c36f2]
- Updated dependencies [71a3eb6]
- Updated dependencies [71a3eb6]
- Updated dependencies [71a3eb6]
- Updated dependencies [53c36f2]
- Updated dependencies [53c36f2]
- Updated dependencies [c89c541]
- Updated dependencies [c09dbbb]
- Updated dependencies [66e21e3]
- Updated dependencies [2b5c337]
- Updated dependencies [4824a5a]
- Updated dependencies [d698709]
- Updated dependencies [4824a5a]
- Updated dependencies [5d33422]
- Updated dependencies [0f1fa68]
- Updated dependencies [5d33422]
- Updated dependencies [766416f]
- Updated dependencies [766416f]
- Updated dependencies [ec9726a]
- Updated dependencies [766416f]
- Updated dependencies [5a70646]
- Updated dependencies [ec9726a]
- Updated dependencies [d698709]
- Updated dependencies [66e21e3]
- Updated dependencies [ec9726a]
- Updated dependencies [9b7b570]
- Updated dependencies [847d025]
- Updated dependencies [ec9726a]
- Updated dependencies [847d025]
- Updated dependencies [d698709]
- Updated dependencies [766416f]
- Updated dependencies [ec9726a]
- Updated dependencies [a627c9d]
- Updated dependencies [52f032a]
- Updated dependencies [ec9726a]
- Updated dependencies [847d025]
- Updated dependencies [aedbd71]
- Updated dependencies [847d025]
- Updated dependencies [4824a5a]
- Updated dependencies [d698709]
- Updated dependencies [c1ab9fb]
- Updated dependencies [c1ab9fb]
- Updated dependencies [c1ab9fb]
- Updated dependencies [c1ab9fb]
- Updated dependencies [c1ab9fb]
- Updated dependencies [c1ab9fb]
- Updated dependencies [c1ab9fb]
- Updated dependencies [c1ab9fb]
- Updated dependencies [aedbd71]
- Updated dependencies [c1ab9fb]
- Updated dependencies [766b5de]
- Updated dependencies [a627c9d]
- Updated dependencies [852f9dd]
- Updated dependencies [852f9dd]
- Updated dependencies [8a898a7]
- Updated dependencies [852f9dd]
- Updated dependencies [52f032a]
- Updated dependencies [5d33422]
- Updated dependencies [489b687]
- Updated dependencies [bc91814]
- Updated dependencies [489b687]
- Updated dependencies [5a70646]
- Updated dependencies [9b7b570]
- Updated dependencies [9b7b570]
- Updated dependencies [9b7b570]
- Updated dependencies [9b7b570]
- Updated dependencies [a3fcd4f]
- Updated dependencies [769efe5]
- Updated dependencies [769efe5]
- Updated dependencies [769efe5]
- Updated dependencies [aae4b97]
- Updated dependencies [aae4b97]
- Updated dependencies [4be76a3]
- Updated dependencies [766b5de]
- Updated dependencies [c89c541]
- Updated dependencies [205adc0]
- Updated dependencies [5d33422]
- Updated dependencies [52f032a]
- Updated dependencies [8a898a7]
- Updated dependencies [2ed1d82]
  - @opencharacter/spec@0.4.0

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
