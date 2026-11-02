# @opencharacter/spec

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

- 71a3eb6: Countercharm, the Rod of Alertness's Protective Aura, Pass without Trace and Spirit Guardians project their aura from each applied entry the creature applied itself (`scope: applied`), one aura per entry, whatever the spell was cast from. Aura of Courage and Aura of Devotion are auras for friendly creatures in `aura.range` while the paladin is conscious, with `immuneTo` (frightened, charmed). Breaking: their `aura-of-courage` and `aura-of-devotion` `ally` actions are removed; `ally` entries saved before keep their immunity. A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
- 53c36f2: When concentration ends, the new required follow-up `concentration-ends` ends the caster's concentration spells on every creature holding one (`removeEffect` `to: applied`, by the entries' `appliedBy`; entries saved without an applier stay the app's). Conformance suite: `follow-up-clear` expects it after a lost concentration check.
- 53c36f2: Aura of Protection, Countercharm and the Rod of Alertness's Protective Aura are auras (`auras`): computeSheet lists them while they are up (Aura of Protection while the paladin is conscious, at `aura.range`; Countercharm while the bard performs; the rod while planted) for the app to place on allies inside. Aura of Protection's entry reads the paladin's live Charisma modifier through `appliers`. The paladin's own bonus now needs it conscious, as the SRD says. A creature counts one Aura of Protection or rod bonus (stackKey `source`), so the holder in its own aura and an ally with an older `ally` entry aren't counted twice. The `ally` actions stay. Conformance suite: `5e-aura-of-protection-holder` and `5e-aura-of-protection-ally`.

  An aura is up only through its holder's own entry (one with no applier or applied by the holder), so a creature standing in another's Countercharm, Rod of Alertness, Spirit Guardians or Pass without Trace doesn't project it too, and Countercharm's `countercharm` and `end-countercharm` look at the bard's own performance only. Countercharm's bonus to saves against charm and fear counts once (stackKey `source`).

- 53c36f2: Spell cards carry the character's numbers: the spell type has computed values `castingClass`, `spellDc`, `spellAttack` and `spellMod` (in computeSheet's `activationValues`), worked out as `cast-spell` does (a stored spell's own numbers, a magic item's own DC and attack bonus, else the class's), and the spell block ends with "Save DC 14" or "Spell attack +6". `cast-spell` reads them instead of recomputing; a spell on no class's list now casts with the character's highest DC and attack bonus rather than 0. Conformance suite: `sheets/5e-spell-card-values`.

  The draconic ancestry carries its breath weapon's save DC and dice as computed values (`breathDc`, `breathDice`), which `breath-weapon` reads.

- 769efe5: Spells with a per-cast choice ask for it and apply it, as 5.2's do: the spell type has `castOptions` and the `option` state, and `cast-spell` asks for the option per target (or for the caster) and saves it on the applied spell. Protection from Energy (resistance to the picked type), Fire Shield (warm or chill: resistance to cold or fire, and an `erupt` action for the 2d8 on a melee attacker instead of damage at the cast), Enhance Ability (advantage on the picked effect's ability checks), Enlarge/Reduce (advantage or disadvantage on Strength checks and saves, ±1d4 weapon damage) and Blindness/Deafness (blinded or deafened on a failed save) use it. Conformance suite: `5e-cast-aid-upcast` expects the applied spell's empty `option`.
- 769efe5: Divine Smite is offered on the hit, as 5.2's is: a melee weapon attack's on-hit choice offers a smite per spell slot level the paladin has left (and the pact slot); picking one spends the slot and adds 2d8 radiant plus 1d8 per slot level above 1st (5d8 at most), plus 1d8 against an undead or a fiend, to the hit's damage roll, so a critical hit doubles it. The `divine-smite` action stays. Conformance suite: `5e-paladin-sacred-weapon-attack` expects the on-hit choice, `none` recommended.
- 769efe5: Guided creation (`create-character`) recommends the ability scores: each method (rolled, point buy, standard array) recommends them by the class's ability priority, the highest to its first ability (point buy at the same spread), as 5.2's does, so an automatic run no longer stops at the allocation. Conformance suite: `5e-create-guided-array` expects the recommended array and the pause at the first pending pick.
- 769efe5: Hunter's Mark is modeled, as in 5.2: casting it applies the spell to the target, the target's `huntersMark.markedBy` lists who marked it (each applied spell's `appliedBy`; also in the `target` view), and the caster's weapon damage against a creature it marked adds 1d6 of the weapon's type. Its `move` action ends the caster's mark wherever it is (`removeEffect` `to: applied`) and marks a new creature. Conformance suite: `5e-hunters-mark-move` and `5e-hunters-mark-marked-by`.

  Hunter's Mark's `move` is offered only while the caster concentrates, and the new target's entry keeps the slot the spell was cast with (the optional `slot` parameter, else 1st) as `castSlot`.

- 53c36f2: A magic item's power that is out of charges or used since dawn isn't offered: each `use: item-power` that spends charges has `available: self.charges >= <n>` on the use, and the Rod of Lordly Might's and the Staff of Thunder and Lightning's once-per-dawn properties check `usedToday` in their actions' `available`. Conformance suite: `5e-rod-of-lordly-might-used` expects `unknown-action`.
- 71a3eb6: A monster's AC, senses, XP and legendary action count are copied onto its sheet too, so the
  whole stat block is a snapshot (#216). `create-monster` sets them as inputs: `combat.printedAc`
  (a new field; it competes with worn armor and Mage Armor as any AC does), `senses.darkvision`,
  `senses.blindsight`, `senses.tremorsense`, `senses.truesight`, `senses.telepathy`, `challenge.xp`
  and `legendary.actions`, which were derived. The `monster` item no longer sets them. Effects
  (Darkvision, Devil's Sight, goggles, lycanthrope forms) still apply on top. Upgrading from 0.3.0
  saves a monster's values from its stat block; other characters get 0.
- 71a3eb6: `weapon-attack`, `unarmed-strike` and their damage steps are tagged `attack-hit` (the unarmed strike also `unarmed`). Stunning Strike and Open Hand Technique are parameters of those attacks (`stunningStrike`; `openHand` on the unarmed strike): on the hit, an `action` effect on that step spends the ki and hands the target its saving throw at the ki save DC, stunned or knocked prone on a failure. Breaking: the `stunning-strike` and `open-hand-technique` actions, which only reported the DC, are removed. A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
- 71a3eb6: Reactions to who hit you, read from the damage's sender (`change.from`): Hellish Rebuke offers its cast when another creature damages the caster; Fire Shield offers `erupt` when a creature hits the caster with a melee attack while the shield is up; Multiattack Defense records each creature that hits the ranger with an attack (a required follow-up, in the pick's new `hitBy` state), exposed as `combat.multiattackDefense` so that creature's later attack rolls against the ranger take -4 (as +4 AC). A new `turn-boundary` clock rules action, run by the app on every creature at each turn change, clears it. Breaking: Fire Shield's `erupt` is listed on the spell's holder while the shield is up, no longer on the applied entry (`scope: applied`). A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again. The caster's or ranger's own damage to itself (`change.from` its own `id`) triggers none of them.
- 53c36f2: The guided start finishes unattended, as 5.2's does: its race, subrace, class and background recommend the first offered, and every pick creation or a level-up asks recommends one of the options it offers (`recommend` over `options`): class skills, tools, fighting styles and subclasses, languages, expertise, spells (a class's staple spells first, then the highest level offered), invocations (Agonizing Blast only with Eldritch Blast), the pact boon, Metamagic, Mystic Arcanum, the hunter's tactics, subraces and draconic ancestries, and each starting-equipment pick. An Ability Score Improvement recommends +2 to the highest ability that takes it, else +1 to two, else a feat. Conformance suite: `5e-create-guided-pauses` becomes `5e-create-guided-finishes`; `5e-create-guided-array` pauses its picks to show the hill dwarf's recommended tool; the point-buy, roll and if-proficient cases answer every pick; options cases expect the recommended option.
- 53c36f2: Spirit Guardians and Pass without Trace are auras (`auras`). Casting Spirit Guardians also puts the spell on the caster (a `changes` effect on `cast-spell`'s concentration step, now tagged `spell.concentrate`), which holds its 15-foot aura up: enemies inside have their speed halved; the save and damage after the cast are the app's (casting again would spend another slot). Pass without Trace cast with no target holds its 30-foot aura up for allies; a creature counts one +10 (stackKey `source`).
- 53c36f2: Chromatic Orb's first orb is its cast: the spell adds a `damageType` parameter to its own `cast-spell` (a `params` effect), and `cast-spell`'s new `spell.cast` step (its listing is tagged `spell.cast` too) sets the cast's damage type from it, so the ranged spell attack and the 3d8 (+1d8 per slot level above 1) come with the slot spent. The `orb` action stays for a leap. Conformance suite: `5e52-cast-chromatic-orb-type`.
- 71a3eb6: The Rod of Alertness's Protective Aura, Aura of Life, Holy Aura, Pass without Trace and Spirit Guardians project their aura from each applied entry the creature applied itself (`scope: applied`), one aura per entry (computeSheet's `auras` names that entry), whatever the spell was cast from. Aura of Courage and Aura of Devotion are auras for allies in `paladin.auraRange`, down while the paladin is Incapacitated, with `immuneTo` (Frightened, Charmed), so allies' immunity is no longer text.
- 53c36f2: Sap, Slow and Vex (and Studied Attacks' Vex) read who applied them from the entry's `appliedBy`, which every attack now records, instead of the `attacker` state the attack wrote; `attacker` stays declared and is still read for entries saved without an applier. A new rules action, `turn-boundary` (`clock: turn-boundary`), which the app runs on every creature at each turn change, ends Sap and Slow when their applier's next turn starts, and Vex when that turn ends (a new `armed` state on combat effects, default false, marks that the turn has started). Conformance suite: `5e52-turn-boundary` and `5e52-turn-boundary-ends`; `5e52-attack-vexed-target-advantage` expects the applier-reading query.

  Hex and Hunter's Mark: `hex.cursedBy` and `huntersMark.markedBy` name each applied spell's `appliedBy` (the `caster` state is no longer written, and is still read for entries saved without an applier), and each spell has a `move` action that ends the caster's curse or mark wherever it is (`removeEffect` `to: applied`) and puts it on the new target (Hex asks its ability again). Conformance suite: `5e52-hex-move` and `5e52-hex-cursed-by`; `5e52-cast-enhance-ability-per-target` no longer expects `caster` on the applied spell.

  When concentration ends, the new required follow-up `concentration-ends` ends the caster's concentration spells on every creature holding one (`removeEffect` `to: applied`, by the entries' `appliedBy`; entries saved without an applier stay the app's). Conformance suite: `5e52-concentration-ends`.

  effects.md: the Vexed example reads the entry's `appliedBy`.

  Hex's and Hunter's Mark's `move` is offered only while the caster concentrates, and the new target's entry keeps the slot the spell was cast with (the optional `slot` parameter, else the spell's level) and the caster's spell save DC (`castSlot`, `castDc`).

- 53c36f2: Brutal Strike's blows are modeled: the feature adds a blow parameter to every attack (`params` effect), and Improved Brutal Strike at level 17 a second, `brutalBlow2`. When the Brutal Strike hits, Hamstring Blow puts the new `combat-effects.hamstrung` on the target (Speed −15, the most recent one only) and Staggering Blow (Improved Brutal Strike) the new `combat-effects.staggered` (Disadvantage on its next saving throw, which ends it). Forceful Blow's push and Sundering Blow's +5 stay the player's. The combat effects group is labeled "Combat effects". Conformance suite: `5e52-attack-brutal-strike-blows`.

  Hamstring Blow ends at the start of the barbarian's next turn: the `turn-boundary` action removes it with Sap and Slow (`5e52-turn-boundary` expects it in the query). Staggering and Sundering Blow are offered from level 13: Brutal Strike's `brutalBlow` (Forceful or Hamstring) gives way there to Improved Brutal Strike's `improvedBlow`, which offers all four.

- 53c36f2: Spells carry the character's numbers: the spell type has computed values `castingClass`, `spellDc`, `spellAttack` and `spellMod` (in computeSheet's `activationValues`), worked out as `cast-spell` does (a stored spell's own numbers, a magic item's own DC and attack bonus, else the spellcasting's, else the character's highest). `cast-spell`, `spell-effect` and the actions of Moonbeam, Flaming Sphere, Ice Knife, Insect Plague, Glyph of Warding, Flame Blade, Guardian of Faith, Faithful Hound and Incendiary Cloud read them instead of recomputing; a spell on no list (Gift of the Depths' Water Breathing) now casts with the character's highest DC rather than 0, and a stored spell's later turns use its stored DC. Conformance suite: `sheets/5e52-spell-card-values`.

  Features carry their card numbers as computed values, which their actions read: Breath Weapon's `breathDc` and `breathDice`, Cunning Strike's `strikeDc`, Intimidating Presence's `presenceDc`, Relentless Rage's `rageDc`, Sacred Weapon's `weaponBonus` and Preserve Life's `healingPool`. Conformance suite: `actions/5e52-breath-weapon`.

- bf23fd5: Cunning Strike's Trip against a Huge or larger target costs no Sneak Attack die: it does nothing, so the full Sneak Attack lands, and an Improved Cunning Strike pair counts it as free. The conformance suite adds `5e52-attack-cunning-strike-huge`.
- ec9726a: 5e-srd-5.2: the D20 Test's rolls classify by a `d20` band set, its `success` band marked as the success threshold, so a roll's summary shows the DC or AC it needs (#175). Conformance tests for the attack and saving throw summaries.
- 71a3eb6: Deflect Attacks reduces an attack's total damage once: the `deflectAttacks` situational choice is `scope: batch`, so one selection reaches the whole attack, its 1d10 + bonus spent over its Bludgeoning, Piercing and Slashing parts in order (every damage type with Deflect Energy). When all the damage is stopped and a Focus Point is left (the new `focus.spent` field), its `changes` offer the new `deflect-redirect` follow-up (a rules action running the feature's action, available only while a Focus Point is left). Breaking: the choice is batch-scoped, and the `deflect-attacks` action no longer rolls the reduction: its `damage` parameter and `deflected` result are gone; it is the redirect (1 Focus Point, the redirected damage). A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
- 53c36f2: Fire's Burn, Frost's Chill and Hill's Tumble are offered on a weapon or Unarmed Strike hit: the Goliath's hit option adds 1d10 Fire or 1d6 Cold to the hit's damage roll (doubled on a Critical Hit), and `changes` effects on the attack's damage step (now tagged `attack-hit`) slow or knock Prone the target (Large or smaller) and spend the Giant Ancestry use. The powers' own actions stay for other attack rolls. Conformance suite: `5e52-attack-frosts-chill`, `5e52-attack-hills-tumble-too-large`.
- 53c36f2: A magic item's power that is used since dawn or out of charges isn't offered: each `use: item-power` that presets `daily` or `charges` (the elemental-commanding bowl, brazier and censer, Dagger of Venom, Dragon Scale Mail, Dust of Dryness, Javelin of Lightning) has `available` on the use. Conformance suite: `5e52-javelin-of-lightning-used`.
- 71a3eb6: A monster's AC, senses, XP and Legendary Action uses are copied onto its sheet, so the whole stat
  block is a snapshot (#216). `create-monster` sets them as inputs: `combat.printedAc` (a new field;
  it competes with worn armor and Mage Armor as any AC does), `senses.darkvision`,
  `senses.blindsight`, `senses.tremorsense`, `senses.truesight`, `senses.telepathy`, `challenge.xp`
  and `legendary.actions`, which were derived, and the new `challenge.xpLair` and
  `legendary.actionsLair`, which replace them while `legendary.inLair`. The `monster` item no longer
  sets them. Effects from traits, spells and items still apply on top. Upgrading from 0.3.0 saves a
  monster's values from its stat block; other characters get 0.
- 71a3eb6: Cunning Strike, Stunning Strike, Open Hand Technique, Hurl Through Hell and the Rod of Lordly Might's Drain Life and Paralyze are parameters of each attack (`cunningStrike`, `cunningStrike2`, `stunningStrike`, `openHand`, `hurlThroughHell`, `drainLife`, `paralyze`). On the hit, an `action` effect on the attack's `attack-hit` step hands the target its saving throw at the feature's DC and applies the condition (or Hurl Through Hell's 8d10 Psychic damage) on a failure; the cost (a Focus Point, the use or a Pact Magic slot, the rod's daily use) is spent with it. `weapon-attack` and `unarmed-strike` are tagged `attack-hit` (and the Unarmed Strike `unarmed`), so the parameters are added to those attacks only, Open Hand Technique's to the Unarmed Strike. Cunning Strike's dice come off the Sneak Attack, read from the parameters; an effect the rogue can't use (the new `rogue.strikeEffects`: not known yet, or Poison without a Poisoner's Kit), or effects together costing more than the Sneak Attack, do nothing and cost nothing. Its DC is the new `rogue.strikeDc` field. `item-power`'s outcome data adds `failed`. Breaking: the `cunning-strike`, `stunning-strike`, `open-hand-technique` and `hurl-through-hell` actions, the rod's `drain-life` and `paralyze` actions, and the `cunningStrike` situational choice are removed. A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again.
- 71a3eb6: Reactions to who hit you, read from the damage's sender (`change.from`): Hellish Rebuke offers its cast when another creature damages the caster; Fire Shield offers `erupt` when a creature hits the caster with a melee attack while the shield is up; Multiattack Defense records each creature that hits the ranger with an attack roll (a required follow-up, in Defensive Tactics' new `hitBy` state), exposed as `combat.multiattackDefense` so that creature's other attack rolls against the ranger have Disadvantage until the `turn-boundary` action clears it. Breaking: Fire Shield's `erupt` is listed on the spell's holder while the shield is up, no longer on the applied entry (`scope: applied`). A paused action saved under 0.3.0 that runs one of the removed or changed actions can't be resumed: start it again. The caster's or ranger's own damage to itself (`change.from` its own `id`) triggers none of them.
- 53c36f2: Every pick a guided start or a level-up asks recommends one of the options it offers (`recommend` over `options`), so an automatic run of either start, or of a level-up to 20, finishes for every class: class skills, tools and subclasses, background and feature languages, expertise, spells (a class's staple spells first, then the highest level offered; the old lists ran out on later levels), invocations (only ones whose level prerequisite the warlock meets), Mystic Arcanum, Metamagic, Signature Spells and Spell Mastery, the species lineages and the other feature options. Recommendations that read `choice.picks` now read `options` (weapon masteries, Keen Senses, Skillful, the fighting-style cantrips). Conformance suite: `5e52-create-guided-recommended` and `5e52-create-higher-level` finish with no answers, `5e52-create-guided-pauses` is gone, and `5e52-level-up-warlock-auto` levels a warlock to 2 with no answers.
- 53c36f2: Spirit Guardians, Aura of Life, Holy Aura and Pass without Trace are auras (`auras`). Casting Spirit Guardians also puts the spell on the caster (a `changes` effect on `cast-spell`'s concentration step, now tagged `spell.concentrate`), which holds its 15-foot aura up: enemies inside have their Speed halved. Its new `guard` action runs the Wisdom save and the 3d8 (plus 1d8 per slot level above 3, Radiant or, with `necrotic`, Necrotic) for a creature the Emanation reaches, at the caster's spell save DC and without spending a slot, while the caster concentrates. Aura of Life (Necrotic resistance), Holy Aura (Advantage on saves, Disadvantage on attacks against them) and Pass without Trace (+10 Stealth, counted once by stackKey `source`), cast with no target, hold their auras up for allies. Conformance suite: `5e52-spirit-guardians-guard`, `5e52-cast-spirit-guardians-aura`, `5e52-spirit-guardians-aura`, `5e52-spirit-guardians-enemy` and `5e52-paladin-aura-ally`.
- ec9726a: `issues.too-many-picks.choice` and `issues.choice-not-applicable.choice` lead a choice issue with its choice's prompt, so a rules-level choice's issue (fitd-crew's Rigging after its box is unmarked) names what it's about; a slot's prompt gets its number as `{slot}` (#175).
- d698709: A view-field set's family keys expand where the set is declared, so a content action's
  participant role that names the set gets the expanded fields, as a rules action's role does.
  Before, the role kept the unexpanded keys and loadRuleset failed with `unknown-name` on a formula
  reading one (#183).
- ec9726a: A field shows in each display group it's in, and the repeat is intended (a summary repeats headline values), so apps don't dedupe; the display-hints doc says so. 5e-srd-5.2's `concentration.active` is in `combat` only, and orc-2e's and orc-sf-2e's spellcasting proficiency ranks (`spellcasting.rank`, the archetype ranks) are in their spellcasting group only, no longer in `proficiencies` too (#175).
- 9b7b570: loadRuleset reports `duplicate-content-id` (data `id`, `pack`) when two content items of one
  pack share an ID, instead of keeping the last silently.
- 847d025: fate-core: Killing Stroke is the stunt's own: `changes` effects on the attack's new tagged steps `attack.consequence` (setting the `strokeOffered` flag for a Fight attack with its use left this scene) and `attack.stroke` (marking the use of the copy that offered it, named in `strokeBy`), so an add-on stunt can make a forced consequence worse too. The attack no longer names the stunt. Extras compute their bonus, Weapon and Armor at their ranks (`bonusTotal`, `weaponTotal`, `armorTotal`), and Super-Strength's and Super-Resilience's cards show them. No saved shape changes. Conformance case for a used Killing Stroke.
- ec9726a: fitd-crew: a crew advance's two upgrade boxes may buy a new gang or expert cohort (with its edge and flaw) instead of upgrades (#175). Conformance test for it.
- 847d025: fitd-crew and fitd-scoundrel: the READMEs describe the crew as the reference shared sheet (every member links one crew file; apply each member's heat as its own batch and recompute the crew before the next). fitd-scoundrel: Expertise computes the chosen action's rating (`action`, a computed value on the picked ability), and its card names it. No saved shape changes. Conformance case for the card value.
- ec9726a: `errors.invalid-option` has variants by its data: `errors.invalid-option.param`, `.field` and `.target` name the parameter (by its label), the character field (by its name), or the item field or state key the option was for, as the other parameter errors do (#175).
- ec9726a: mork-borg-core: plain die rolls that are neither tests nor damage (a weapon's doom and curse d6, the Fanged Deserter's bite exposure, rattled wizard teeth, a lobbed gob's blindness, an omen's warding d6) are tagged `chance`, not `attack` or `defense`, so invisibility, the poltroon and the sinner's bonuses no longer reach them and Eurekia's curse can roll a 1. Conformance test for it.
- 847d025: mork-borg-core (breaking: situational choices are removed or changed): homebrew that reads `situational.omenDamage`, `situational.teeth` or `situational.invisible` no longer loads, and an app that passes them has them ignored. `grace` is now an enum, not a boolean, offered only while a Grace for a Sinner boon is held.

  What apps must change:
  - **Maximum damage:** instead of `situational.omenDamage` or `situational.teeth`, answer the `maximum` choice that `attack` and Coward's Jab ask after a hit (`roll`, recommended; `omen`; `tooth`). Under an automatic policy the damage is rolled.
  - **Scrolls:** pass the one creature a Grace for a Sinner or Metzhuotl Blind Your Eye is read on as `use-power`'s `target` participant (the reader itself, to take it), and apply the proposed `applyEffect` to that sheet. That replaces `situational.invisible` and the old boolean `grace`.
    - `boons.unseen`: +6 on attack and defense for its rounds, or until the holder takes damage.
    - `boons.grace`: its rolled bonus on one roll. The holder picks the roll with `situational.grace: test` or `damage`; that roll ends it.
  - **Rounds:** run the new `turn-boundary` clock action on every character at each turn change. It counts down applied entries that last rounds as their applier's turn starts.
  - **Poltroon:** apply the jester sheet's `capering` aura entry to those fighting beside it. `poltroon` (the owner) and `poltroonAlly` (others) stay for characters the aura isn't on. They are no longer offered while a capering entry is held, or to the owner while a linked jester is at 0 HP.

  Also:
  - Coward's Jab is offered by the weapon type's `use` entry (`available`).
  - A scroll's card shows the reader's Presence on its duration (a computed `durationBonus`, left out at 0).
  - Backlash, infection and hunger roll their dice tagged `damage.direct`, below `damage`, so effects on `damage` rolls still reach them and only Grace's damage bonus leaves them out by name.

  No saved shape changes. Conformance cases for each.

- aedbd71: mork-borg-core: a shield sacrifice (`situational.shieldSacrifice`) breaks one shield per blow, the first worn unbroken one, instead of every worn shield on every change that selects it. The choice holds the effect and the break; the shield type's `shield-sacrifice` effect is gone, so the break's entry in `adjustments` is a `{ copies }` entry whose `source` is the choice, not the item's effect. Direct damage still breaks nothing.

  No saved shape changes. Conformance case: one of two worn shields breaks.

- 847d025: mothership-1e (breaking: a situational choice is removed): the Android's trauma response is an aura (`unease`, on allies) that puts Fear saves at [-], replacing the situational choice `android`. Homebrew that reads `situational.android` no longer loads, and an app that passes it has it ignored.

  What apps must change:
  - Apply the Android's `unease` aura entry (`applyEffect` with `source: mothership-1e:classes.android`, `aura: unease`, `appliedBy` the Android) to each close crewmate, and remove it as they leave, instead of passing `situational.android`.
  - Bleeding: run EITHER the new `turn-boundary` clock action at every turn change (it takes a bleeding character's health as its own turn starts) OR `bleed` once a round, never both, or bleeding counts twice.

  Also: the weapon type's `use` entries offer `shoot` or `attack` by the magazine (`available` on the use), and shore leave's split recommends every converted point to the lowest save, so an unattended run finishes. No saved shape changes. Conformance cases for the aura, the turn change and the recommendation.

- d698709: An offered follow-up that the content adding the option or changes doesn't declare (nor its
  content type) falls back to the content defining the action, then to the rules, as the spec
  says: content adding to a rules action's tagged step can offer the rules' follow-up. Before,
  it was `unknown-reference` (#184).
- c1ab9fb: The belt of long life gives its temporary Hit Points again when invested: its own `effectsWhen`
  lifts the worn type's investiture gate (Invest an Item runs before the belt is invested), and its
  Constitution effects keep their own invested condition. Conformance suite:
  `orc-invest-belt-of-long-life`.
- c1ab9fb: Bless, protective wards and protector's sphere are cast on the caster, whose entry projects the
  emanation as an applied aura (`scope: applied`, one per cast) for the app to place on allies
  inside, instead of an entry per ally passed to the cast. Sustaining bless or protective wards to
  widen it is the spell's `widen` action (a `widened` state key the aura's size reads; wards to 30
  feet). The sphere's resistance by rank reaches allies through the caster's
  `spells.sphereResistance`. Entries already on allies keep their effects. Conformance suite:
  `orc-cast-bless-aura`, `orc-bless-widen`, `orc-bless-aura`, `orc-protectors-sphere-ally`.
- c1ab9fb: A check's reroll option may keep the better result (`reroll` flag 2) as well as the new one
  (1). Halfling Luck (a failed skill check or save), Cat's Luck (a failed Reflex save, the better
  result) and Spiritual Guides (a failed, not critically, Perception or skill check) offer their
  once-a-day rerolls on `check.reroll`, marking the feat used (a `used` state key, reset by daily
  preparations). Conformance suite: `orc-halfling-luck-reroll`.
- c1ab9fb: Scars of Steel is a batch-scoped situational choice on a critical hit (`scarsOfSteel`, offered
  while raging and unused today): resistance equal to the Constitution modifier plus half the level,
  spent over the attack's physical damage, paid once per attack from the new input field
  `barbarian.scarsOfSteelUsed`, which daily preparations reset. Conformance suite:
  `orc-scars-of-steel`.
- c1ab9fb: Bless, protective wards and protector's sphere project their aura only from an entry the caster
  applied itself (`self.appliedBy == character.id`), so an older entry on an ally (no applier)
  keeps its bonus but projects nothing. Their `widen` action is once a turn (a `sustained` state
  key the caster's next turn clears) and carries the concentrate trait instead of the `spell` tag.
  A reroll that keeps the better result keeps the higher total on the same degree. Conformance
  suite: `orc-bless-sustain-turn-start`; `orc-bless-aura` pins an old-shape entry.
- c1ab9fb: A failed check (`check`: skill actions, Perception, saves) offers a Hero Point reroll after the
  roll: a `check.reroll` choice step whose option the rules add while the character has a Hero
  Point, paying it in its `changes`. Declining is recommended, so an automatic run doesn't pause;
  the second roll (`rerolled`) stands. Spell Devourer reads the result that stands. Conformance
  suite: `orc-check-hero-point-reroll`; failed-check cases log the declined choice.
- c1ab9fb: Bless is cast on the caster, whose entry projects its emanation as an applied aura
  (`scope: applied`, one per cast) for the app to place on allies inside; Sustaining it to widen it
  is its `widen` action. The precog paradox's quantum field (a witchwarper's, or an archetype's
  with Basic Quantum Field) is two auras while it's active, `quantum.radius` across: enemies'
  Speeds −5 status, allies' +5 status. Anthem gives the bonded creatures passed as allies +1 status
  to attack and damage rolls and to saves against fascinated or confused (the new situational
  `againstFascinatedOrConfused`). Conformance suite: `orc-sf-bless-aura`,
  `orc-sf-precog-quantum-field`, `orc-sf-precog-field-ally`.
- c1ab9fb: Natural Grace (a failed Acrobatics check or Reflex save), Center Thoughts (a failed Will save,
  the better result) and the chosen pahtra (the first critically failed save each day) offer their
  once-a-day rerolls on the check's `check.reroll` step, marking the pick used (a `used` state key,
  reset by daily preparations). Conformance suite: `orc-sf-center-thoughts-reroll`.
- aedbd71: orc-2e and orc-sf-2e: Shield Block (`situational.shieldBlock`) reaches the whole attack (`scope: batch`). The shield's hardness comes off the attack's total once, however many damage types it splits into, and the raised shield takes what is left of the total, clamped to its remaining Hit Points: a block that destroys the shield no longer rejects the attack. The shield type's per-change `block` effect is gone, so the shield's `damage` entry in `adjustments` is now a `{ copies }` entry whose `source` is the choice (`{ type: situational, id: shieldBlock }`), not the item's `block` effect.

  What apps must change: select `shieldBlock` on the first damage change of an attack and route the attack's damage as one batch. The Shield spell and Fire Shield still block per damage change (#258).

  No saved shape changes. Conformance cases: a split Strike blocked once, and a block past the shield's Hit Points.

- c1ab9fb: A Strike's critical hit tags the damage it deals `damage.critical`, as a spell attack's already
  does, so a reaction to a critical hit (Scars of Steel) is offered on it. `orc-scars-of-steel`
  now routes a real critical Strike's damage.
- 5d33422: The shared-sheet convention for a pool several characters spend from (hero tokens, the
  Director's Malice, a crew): its own character file, linked from each character through one slot,
  with each character's spend applied to it as its own batch and the view recomputed before the
  next. Conformance cases cover a hero spending from a linked party pool, a second hero finding it
  empty, and a stale spend meeting the pool's bound (#189).
- 9b7b570: dice-and-actions.md and engine-actions.md catch up with the engine: `to: applied` routing, the
  reaction route through situational choices, every action and roll part property, the full dice
  notation, every safety limit and every error startAction can return. The Fate group example is
  valid, and Healing Grace bounds `spend`. dice-modifiers.json gives every notation form and
  `rerollOnce`'s `count`.
- 9b7b570: effects.md, content.md, characters.md and display-hints.md catch up with the format: the full
  ops and property tables (`params`, `scope`, the `changes` and `option` value shapes), examples
  that match the packs (Null Field, `effectsWhen` gates, `appliedBy: self`), every content item and
  choice property in the tables, and the once-per-attack route for copy-state costs.
  effect-operations.json, stacking-policies.json and the character schema's `applied.aura`
  descriptions match.
- 9b7b570: engine-core.md, engine-interface.md and upgrades.md catch up with the engine: aura entries and
  the `auras` output, `unknown-situational` on an adjust, the pack limit on `fields` queries,
  `setField`, `appliers` on every call that takes them, every error kind, the full `choices`,
  `offers` and applyChanges output shapes, pick copies in upgrade steps, and derived parameters and
  added bounds in release checks. change-types.json, rules-issue-codes.json, upgrade-steps.json and
  error-codes.json descriptions match.
- 9b7b570: formulas.md gives every root where it is bound and typed (`appliedBy`, `applier`, `grant`, `i`,
  `changes` and `action` effects, derived parameters, a situational choice's copy changes) and
  every place's expected type. i18n.md and the en.yaml header list the `invalid-added-param`
  reasons and how an added parameter is named. packs.md describes `LicenseRef-` licenses. The
  README, rules-and-fields.md and versioning.md are brought up to date, and formula-context.json
  and safety-limits.json descriptions match.
- a3fcd4f: The shared-sheet example in `rules-and-fields.md` names the real `draw-steel-heroes` party link.
- 769efe5: Conformance suite: `fate-create-guided-pauses` is now `fate-create-guided-auto`: fate-core's guided start, run automatically, finishes with the recommended pyramid and stunts instead of pausing at the pyramid.
- 769efe5: Conformance suite: `fitd-crew-advance-members` passes two members to fitd-crew's `crew-advance`, each taking tier + 2 stash on their own sheet.
- 769efe5: Conformance suite: `fitd-create-scoundrel-guided-pauses` is now `fitd-create-scoundrel-guided-auto`: fitd-scoundrel's guided start, run automatically, finishes with the recommended dots instead of pausing at the starting dots.
- aae4b97: The conformance case `swn-revised-end-scene-torched` now expects the end of the scene to clear `scene.succor` too.
- aae4b97: The conformance case `swn-revised-sustain-core-technique` now expects `sustain-technique` not to be offered on a granted core technique, which lasts for the scene.
- 4be76a3: The test suite's README lists every test pack in a table, the `computeSheet` keys `auras`, `templated` and `copyNames`, `listOptions`' `errors`, the `appliers` input, and where the reference runner lives.

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
- a26226f: Prerequisite text is a phrase, the requirement alone ("Scout Dedication"); the new standard text `issues.prerequisite-not-met.owner` (`{owner} requires: {requirement}`) names its owner. `text.issue` wraps a pack's prerequisite text with the owner's name, content or inline option, and `keys.issueKey` finds an inline option's prerequisite text (`<item>.choices.<choice>.options.<option>.prerequisites.<id>`). `pnpm validate` warns on prerequisite text that ends with a period or starts with "Requires" or "Needs".
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
- a26226f: Standard text by an error's data: `errors.out-of-range.min` and `errors.out-of-range.max` for an `out-of-range` with only one bound, and `errors.safety-limit-exceeded.<limit>` for each safety limit. `text.error` and `text.issue` use them, and show `errors.other` instead of the raw template when a message misses an argument. The `safety-limit-exceeded` and `out-of-range` descriptions in `error-codes.json` say what their data holds.
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
- 033d16d: Conformance cases for features together: a roll in a repeated group runs its effects' `then` once
  per pass; a formula target on content the derived-value pattern grants; and `pick: owner` and
  `grant: owner` in a roll effect's `then` resolve as in an added option's changes.
- 033d16d: content.md shows how content does one thing or another by a derived value (Harmonic
  Sensitivity's training, or Assurance if already trained): a value choice whose `eligible` and
  `recommend` read the sheet, with the outcome given through another field than the one
  eligibility tests, and a grant following the pick by `picksOf`. Conformance cases cover it
  (#82).
- a26226f: Engine errors carry the data their standard text names: `unknown-name` gives `name` (formula checks no longer give `id`), `unknown-function` gives `function`, `fieldOf()`'s `no-such-key` gives `key` and `family`, `unknown-reference` from actions gives `kind` and `id` (no more `followUp`, `pick` or `grant`), a scope-applied grant's preset choices give `id`, a reapply state key's `wrong-type` gives `target` (was `key`), and `offerFollowUp`'s `unknown-follow-up` gives `id` (was `followUp`). The formula error table says which data each code carries.
- a26226f: An overflow whose adjust on `into` would be clamped to no change (its target at its bound, nothing
  absorbed, no overflow of its own) no longer fires: the field clamps instead. Carried overflow
  stops cycling once its target is full, so more damage never leaves more health and large
  amounts no longer reach `maxOverflowChain` (#100).
- 033d16d: Action parameter errors (`missing-param`, `wrong-type`, `out-of-range`, `invalid-option`) carry
  `action` (the qualified action ID; `<item ID>#<action ID>` for an item's inline action) and, for
  an action started on them, `entry` and `source`. Text names the parameter by its label
  (`"Helpers (+1 each)" must be at least 0.`).
- 033d16d: Conformance cases pin what an action with a role does when the app passes no participant: a role
  without a minimum proposes its changes once with no `character` (the MÖRK BORG Horn), one with a
  minimum fails with `invalid-participants` (Speak Truth).
- 033d16d: `upgrade` lists a `requireChoice` step for a character holding the choice's owner as a pick with no nested picks saved yet, not only when it has some.
- 033d16d: A rules action no copy uses reads the rules-level choices with the one-argument `picksOf` in its
  `available` too, as its steps do: computeSheet lists it, and a follow-up's action is checked, with
  the rules' picks, not an empty owner. Conformance cases for a rules action's `available`, a
  follow-up's action check, and the rules-level formulas where `picksOf(choice)` is unbound.
- f44f66c: Creation docs say a creation action puts everything it decides on the sheet, its outcome being only a report, and that a random start leaves the player's words (string params, text input fields) blank. The conformance suite follows this round's fitd, Mörk Borg and Mothership pack fixes, with new cases for named factions at crew creation and a homebrew cohort's roll.
- 033d16d: Conformance suite: fate-core's skill-roll dice read on its `check` bands against an opposition
  known before them (`roll-summary-fate`), or on the ladder against an opponent who rolls after
  (`roll-summary-fate-opponent`), and log the dice-less `rung` step.
- 033d16d: Conformance suite: `mothership-wound-roll-advantage` expects `wound-roll`'s `rolled` result with the wound type in its data.
- 033d16d: Conformance suite: orc-2e's cases follow its domains becoming content (saved Domain Initiate picks name `orc-2e:domains.<domain>`), and `orc-tengu-wave-fan` expects the fan's use spent on its own pick (`pick: owner`).
- f44f66c: Conformance suite: the `orc-create-character` case answers orc-2e's free boosts before the class's choices, as its guided start now asks them, and the `fate-mara` and `fate-extras` sheets no longer list fate-core's removed `teamwork` situational choice.
- 033d16d: Conformance suite: orc-2e's and orc-sf-2e's random creation cases and
  `orc-skill-mastery-two-skills` follow their skill choices offering `skills.offered` in
  alphabetical order.
- 033d16d: Conformance suite: fate-core's custom stunts save their skill, action, limit, uses and fate point cost as the copy's own fields, and its skill-roll's rerolls are at `rerolling[<n>]/…`; mork-borg-core's clarity and blare are applied `boons`, and the Scum's get-better steps are its `classPart`.
- 033d16d: `checkRelease` no longer reports `state-removed` for an item's state key that the item's content
  type declares in the new release with the same type: its copies keep their saved values. A pack
  may move a key to the type, to open its enum to add-on packs.
- 033d16d: A `prerequisite-not-met` on an inline option another pack added to a choice (`extendChoices`)
  reads the requirement and the option's name from the adding pack's text, found through
  `optionOrigins`, when the owner's pack has none.
- 033d16d: An action inline on a content type, which every item of the type shares, is keyed under the
  type, `types.<type>.<action>…` (`types.stunt.use.name`), as `pnpm validate` already required;
  i18n.md now says so. Its ID is still `<item>#<action>`, so the text helper looks under the item's
  key, then, with `content` in the bundle, under its type's: `text.action`, `param`, `stepPrompt`
  and the rest name a Fate stunt's Use and a free invocation's Invoke instead of showing the ID.
- 033d16d: `too-many-copies`'s standard text names what is held too often: the type for a type's `max`
  ("Archetype: too many are held (at most 0)."), the item for a `perItem` limit with the new
  `issues.too-many-copies.item`.
- 033d16d: An error with no text of its own, or whose text misses an argument, reads as its `data.message`
  when it has one, before `errors.other`. The spec's `errors.other` no longer shows the code to a
  player ("Something went wrong."); it still gets `{code}`, and the guides say to log the code and
  data for developers.

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
