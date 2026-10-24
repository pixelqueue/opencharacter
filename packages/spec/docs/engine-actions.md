# Actions at run time

How `startAction` and `continueAction` run an action: building and rolling each roll, choices,
branches, proposed changes and outcomes, pausing at checkpoints, and replaying from answers.
Action definitions are in [dice-and-actions.md](dice-and-actions.md); call shapes are in
[`../schemas/engine/`](../schemas/engine/). **PROVISIONAL** where marked.

## Starting an action

`startAction` input: `ruleset`, `character`, `action` (`id`, `entry?`, `source?`, `followUp?`), `params`, `situational`,
`policy`, `links` (the views filling the link slots; [engine-core.md](engine-core.md#links)),
`participants` (the other characters taking part, by role; below), `answers` (answers to
replay, one per pause; [Replaying from answers](#replaying-from-answers)) and, outside the JSON
shape, an optional **dice function**.

1. **Find the action.**
   - A rules action has its qualified ID (`5e-srd-5.1:saving-throw`).
   - An action defined on an item is `<item id>#<action id>`.
   - An action reached through a content type or an item's `use` is listed under the used
     action's ID with the copy's `entry`; it runs with that copy's `item` and `self`.
   - An action of picked or granted content also names that content as `source`; it runs with
     that content's `item` and the owning copy's `self`, with the pick's or grant's own state
     keys over it.
   - An action of content with no owning copy (picked in a rules-level choice, or nested in
     such a pick) is named by `source` alone, with no `entry`; it runs with that content's
     `item` and no `self`.
   - The action must appear in `computeSheet`'s `actions` for this character, with the same
     `entry` and `source`, or be one it leaves out only for `listed: false`; otherwise the
     result is `unknown-action`.
   - **`followUp`**: the offer the run takes up, an `id` from computeSheet's
     `offers` for this character, as the offer's `action` gives it; otherwise the result is
     `unknown-follow-up`. For an ephemeral offer, the finished run's `proposedChanges` end with
     `{ to: self, step: '', change: { type: clearFollowUp, id } }`, so applying them deletes
     the stored entry in the same batch. A run that fails, pauses for good or whose changes are
     never applied clears nothing. A derived offer needs no clearing: the action's changes end
     its condition.
2. **Parameters.** Each declared parameter takes the app's value. A `use` that fixes a parameter
   wins over the app's value. Missing required parameters are `missing-param`; wrong types are
   `wrong-type`. Every parameter error (`missing-param`, `wrong-type`, `out-of-range`,
   `invalid-option`), here or at a handoff, also carries `action` (the qualified ID of the action
   the parameter belongs to; `<item ID>#<action ID>` for an item's inline action) and, for an
   action started on them, `entry` and `source`, so text names the parameter by its label
   (`actions.<action>.params.<param>.name`, or the item's `actions.<action>.params.<param>.name`).
   - A number parameter (`integer`, `decimal`) outside its `min`/`max`, once a `use`'s fixed
     value or the default is in, is `out-of-range` (data: `target`, the parameter's name, and the
     evaluated `min` and `max`). The bounds are number formulas evaluated here, as the action
     starts: they see the action's `item` and `self`, `situational` and the character's fields,
     but no `params`, `steps` or `flags` (`amount: { type: integer, min: 1, max: effort.free }`).
   - A **field parameter** (`type: id, of: field`) takes a field ID, qualified or local to the
     action's pack. A field outside its `where` set is `invalid-option`. Formulas see
     `params.<name>` as `{ id, type, tags, value }`: the field view its `where` sees (the qualified
     ID, the field's type and its tags on the sheet, written and computed, `[]` if none) and the
     field's computed value.
   - A **content parameter with `where`** (`type: id, of: <content type>`)
     takes an item ID, qualified or local to the action's pack. An ID that isn't an item of the
     type, or whose item doesn't match `where` (`item` the candidate, the character's fields,
     `action.item` and `action.self` the action's own), is `invalid-option` (data: `param`,
     `option`). Formulas see `params.<name>` as the qualified ID.
3. **Situational choices.** `situational` maps qualified situational IDs to values. Missing
   choices take their `default`. Formulas see `situational.<id>` by local ID. A choice whose
   `available` is false must be left at its default (false for a boolean); selecting it is
   `situational-unavailable` (data: `situational`). Availability is checked once, when the
   action starts, against the character as given; changes the action proposes don't affect it.
4. **Participants**. `participants` maps the roles the action declares to lists
   of views (`{ id, values }`), each taken by the app from that character's own computed sheet.
   - A role the action doesn't declare, or a count outside the role's `min` (default 0) and
     `max` (default unbounded), is `invalid-participants` (data: `role`). A role not given has
     no participants.
   - A view `id` used twice across the call is `duplicate-id` (data: `id`).
   - Each declared field reads the view's value with the same field ID, its pack prefix
     ignored, as a link's does ([engine-core.md](engine-core.md#links)); undeclared values are
     ignored. A value of the wrong type, or two values with one field ID, is
     `invalid-link-value` (data: `role`, `id`, `field`, `expected`): an action has no way to
     report it and go on, so it fails.
   - The participant may use any pack set: the engine reads only the view.
   - `participants.<role>` is the role's views in input order; a view is `id` plus each declared
     field, nested at the dots, with its default when the view lacks it, else absent. A nested
     action (an `action` step) has the participants the step passes on (below), else none: its
     roles are `[]`.
5. **Run the steps** in order, as below. `when: false` skips a step. Each step reads the
   character as given, or with `sheet: proposed` the [proposed sheet](#the-proposed-sheet).

The **context** of a formula in an action:

- `item` and `self`: the copy's views (absent for a rules action run without an entry; content
  without an entry has `item` and no `self`); for an applied entry's action,
  `item` is its source and `self` the entry (`id` and its state keys);
- `character` and `links`;
- `params`;
- `situational`;
- `participants.<role>`, and in an `each` step `participant`;
- `steps.<id>`: results of earlier steps;
- `flags.<name>`: set by branches and by picked choice options.

Fields, `character`, `item` and `self` are read from the step's sheet: the character as given,
or the proposed sheet (below).

Where `item` and `self` are rebound to something else (a choice step's candidates, a formula a
change passes on), the action's own context is `action`: `action.item` and `action.self` (absent
when the action has none) and `action.step`, the current step's `{ id, tags }`, its tags evaluated.

## The proposed sheet

An action proposes changes and never applies them. A step with `sheet: proposed`
(default `given`) reads the character as those changes would leave it:

1. **Building it.** Before the step evaluates anything, `when` included, the engine takes the
   character as given and applies to it, in order, every change proposed so far in this call
   with `to: self` and no `character`: from earlier steps, from nested actions, from a parent
   action that runs this one through an `action` step, and from earlier picks of the same choice
   step. They are applied as one `applyChanges` batch, not strict, with the call's links; the
   sheet is then computed with those links. Changes for a role, a target or a link are never
   applied: they belong to another character. Follow-ups the batch would trigger are neither
   listed nor run; the proposed character's stored follow-ups are never read.
2. **What reads it.** Every formula and source of the step: fields, `character`, the character
   functions (`countCopies`, `sumFields`, …); `self` and `item`, the action's own copy as it is
   on that sheet (absent if a change removed it); a choice step's content, copies, values and
   added options, and the `where`, `prefer` and `recommend` over them; an allocate step's fields,
   their values and `max`; a roll step's parts and roll effects (the effects active on that sheet).
   `params`, `situational` (decided when the action starts), `participants`, `links`, `flags`
   and `steps` don't change.
3. **Per pick.** A choice step with `sheet: proposed` builds the sheet again before each pick,
   since each pick proposes its changes at once. `picks` still counts the step's picks.
4. **Errors.** A batch that fails (a `choose` on a copy that isn't there, a `finishCreation`
   proposed before the step while issues remain, an adjust whose incoming-change effects would
   roll dice, since the batch has no dice function) fails the action with
   `proposed-changes-failed` (data: `step`, the step's path, and `error`, the batch's error with
   its `path`). Only a pack bug reaches it.
5. **Replay.** The proposed sheet follows from the inputs and the recorded answers, so a replay
   rebuilds it exactly; `state` keeps its shape. An engine may cache the sheet per count of
   proposed changes.

Nested steps decide for themselves: a `branch` with `sheet: proposed` reads it in its cases'
`when` and `flags`, and each step in its arms reads its own `sheet`.

## Computed tags

Every tags list with `{ formula }` entries (a roll step's, a roll part's, an action step's, a roll
effect's added item's, a proposed change's) is evaluated when its step runs, in order: a literal tag
is itself; a formula giving a string is one tag, and one giving a list of strings is each of them,
in order, in its place (none for an empty list). A tag already in the list isn't added again. A
computed tag that isn't declared (by the ruleset's packs, a tag declaring the tags above it) fails
the action with `unknown-tag` (data: `tag`); a value that is neither a string nor a list of strings
with `type-mismatch`.

## Roll steps

A roll step is built, then rolled, then classified.

### Building the roll

1. **Parts.** Each part whose `when` holds becomes roll items:
   - **`dice`** evaluates to a dice value. Each dice term becomes a dice item, and a non-zero flat
     part becomes a flat item.
   - **`value`** becomes a flat item.
   - **`field`** names a field: a flat item with that field's value and source.

   A part that reads a numeric field (a `field` part, or a `value` that is a single field
   reference: the parts whose source is the field) **carries** that field's `add` instances
   that have a `stackKey` and counted on the sheet, for step 2.

   Items take the part's `source` (default: the field for a single-field `value` or `field`;
   otherwise the item or rules the action belongs to) and the part's `tags`, with computed tags
   evaluated. A part with `multiplied: false` marks its items `multiplied: false`, its `ifEmpty`
   dice included.

2. **Roll effects.** The candidates are:
   - the character's active instances whose target is `rolls` and whose tags match one of the
     step's tags (computed tags evaluated);
   - the effects of the selected situational choices. A boolean choice is selected when true; an
     integer or enum choice when it differs from its default.

   An instance with `from: self` applies only to rolls made by its own copy: its source entry is
   the action's entry. Each effect's `when` sees `roll` (`item`, `self`, `tags`) and the action
   context, `participants` and `participant` included, with `item`, `self` and the content's
   other roots the effect's own, as an option effect's are: the Bracers of Archery's `self` is
   the bracers' copy, whichever weapon attacks. The action's own item, copy and step are
   `action.item`, `action.self` and `action.step`. Stacking applies, by stack key as in
   the sheet, with the parts' carried instances:
   - For each stack key that some `add` roll effect of this roll has (`source` meaning each
     source's own group, as on the sheet), the group is the roll's `add` effects with that key
     **plus** every part's carried instances with that key. It is reduced by the key's policy,
     as on the sheet (`playerChooses` takes the recommended option, as everywhere but
     computeSheet).
   - A roll effect that doesn't count adds no item, as before.
   - A carried instance that doesn't count any more comes off its part's item: the item's value
     is lowered by the instance's value, and the item lists it in `dropped` (`{ source, value }`,
     [roll-item.schema.json](../schemas/roll-item.schema.json)). Carried instances whose key no
     roll effect has stay in the field's value untouched, so a roll without keyed roll effects is
     built exactly as before.

   A carried instance can only lose: the roll's group holds every instance the sheet's held, so
   one the sheet suppressed is suppressed again. The value comes off the field's final value,
   so a field whose keyed effects are later multiplied or bounded gets the drop after those;
   typed-bonus fields are sums, where the two agree.
   - **`add`** adds an item: dice or flat, with the effect's source and evaluated `tags`. With
     `multiplied: false`, its items, dice and flat, are marked `multiplied: false`.
   - **`rollModifier`** collects one modifier; they apply in the order below. `multiply`
     modifiers stack by key, compared by `factor`.
   - **`atLeast`** and **`atMost`** (without `tally`) bound the total once it is rolled (below).
   - **`set`** with `parts` replaces parts, before anything above reads them
     (below).

   **2a. Replaced parts**. For each part, the counted `set` effects whose `parts`
   tags match its items' tags are stacked by key; of those left, the one
   `settings.competing.recommend` names (default `highest`, by value) replaces the part's items
   with its value's items, carrying the part's tags. Their source is the effect, or the field
   when the value is a single field reference, which the item then reads (it carries that
   field's keyed instances, as in step 1). The first new item lists the replaced items, as
   built, in `replaces`. This happens before the carried instances and `add` effects of step 2
   are worked out.

   **2b. Die steps**. Each dice item from a part moves along d4, d6, d8, d10, d12 by
   the sum of the counted `stepDie` modifiers that reach it (all, or those whose `parts`
   match; stacking by key, compared by `steps`), stopping at the ends. Other sizes stay. The
   item records `steppedFrom`.

3. **Pool dice.** Each `poolDice` adds `count` dice to its part's first dice item (the part named
   by `part`, else the first dice part). In effect order, each added die records the effect as
   its face `source`.
4. **Empty pools.** A dice part whose first dice item has 0 dice after pool dice is replaced by
   its `ifEmpty` dice, if it has one. `empty` is then true.
5. **Advantage and disadvantage.** Count the sources of each kind. A `noAdvantage` modifier sets
   the advantage count to 0, and a `noDisadvantage` the disadvantage count. Then
   apply `settings.rollModifiers.advantage`:
   - **`cancel`** (default): with both, nothing; otherwise one extra die of the present kind.
   - **`net`:** the difference gives the kind and the number of extra dice.
   - **`stack`:** one die per source. Both kinds at once is the error
     `conflicting-roll-modifiers`.

   The extra dice go on the roll's **main dice item**, its first dice item. If that item has no
   keep or drop modifier, it gains keep-better: `keepHighest` (or `keepLowest` when the step says
   `better: low`) of its count before the extra dice, reversed for disadvantage. If it already has
   one, only its count grows.

   **Whole rolls.** When a counted source of the kind that applies says `of: roll`, the extras
   are whole rolls instead of dice: the roll is made once more per extra (below), and nothing is
   added to the main dice item. A roll with no dice items is made once.

   **Parts rolled again.** The sources whose target has `parts` (always `of: roll`) are counted
   apart, after the roll's own, `noAdvantage` and `noDisadvantage` removing them too, and
   combined by the same setting. Unless the roll is made again whole, their extras roll a
   **group** again: the dice items from the parts that a counted source of the kind that
   applies matches. The roll is then made once more per extra, as for whole rolls, but only the
   group's items are copied; the other items are the same in every roll and rolled once.

6. **Multiply dice:** each `multiplyDice` multiplies the count of every dice item except those
   marked `multiplied: false`.
7. **Reroll, minimum face, explode:** each adds its dice modifier (`reroll`/`rerollOnce` at
   `below` or less, `minimum`, `explode`) to every dice item that doesn't have one of that type.
8. **Given faces**: the first counted `setFaces` on an item (the main dice item,
   or the first dice item of a part its `parts` match) gives it its first faces, evaluated
   now; one not on the die is `invalid-face`.

### Rolling

Dice items are rolled in order, each by the formula language's rules
([formulas.md](formulas.md#rolling-dice-values)), with faces from the checkpoint.

- **Whole rolls**: a roll made more than once (`of: roll`, step 5) is built once and
  rolled that many times, each a copy of the built items rolled in full in turn, the first
  roll's dice first. Only the first roll has given faces; the later ones ask for every die. A
  pause's `dice` lists every roll's dice in that order, and `repeat: { times, keep }` says how
  many rolls and which total is kept (`high` or `low`). With parts rolled again, `repeat.items`
  lists the group's items by index in `items`, and `dice` lists every die of the first roll, then
  the group's dice for each later roll; the shared items' faces are asked for once. Each roll's items are multiplied as
  below and summed; the roll whose sum is better (higher, or lower with `better: low`; worse
  for disadvantage) is kept, the first among equal sums. The kept roll's items are the roll's
  items from here on: its total, faces, bounds and band.

- **Given faces**: an item's given faces are its first, before any face from the
  checkpoint, and are marked `set: true`. The checkpoint asks only for the rest: the need's
  `dice` counts exclude them, and a roll with nothing left to ask doesn't pause or record an
  answer (later dice, a reroll or an explosion, are asked for as usual). The log entry's
  `faces` lists only supplied faces.
- **Faces:** under an automatic policy, faces come from the dice function. When paused, the app
  supplies one face per die (see [Checkpoints](#checkpoints-and-the-policy)). A roll with no dice
  items is not a checkpoint: no policy applies, it never pauses, it takes and
  records no answer, and its log entry has `by: engine` and no `faces`.
- **Multiply**: each item's value (a dice item's rolled value with its sign, a
  flat item's value), except the items marked `multiplied: false`, is multiplied by every
  counted `multiply` factor in turn, in effect order. A result whose value before was an integer
  rounds after each multiplication by the effect's `rounding`, else `settings.rounding` (default
  `floor`). Faces are unchanged; the item's `value` is the multiplied value and its `factor`
  the product of the factors. Tallies aren't multiplied.
- **Result:** the roll's total is the sum of every item's value (multiplied), a dice item counting
  with its term's sign; for a roll made more than once, the kept roll's. A `split` change sums the same values per tag.
- **Bounds**: the highest counted `atLeast` roll effect raises the total, then the
  lowest counted `atMost` lowers it. Stacking applies per op. The bounded total is `total`, and
  the band reads it; the items and faces are unchanged.
- **The step's result** (`steps.<id>`):
  - `total`;
  - `faces`: every face of every dice item, in roll order, dropped and rerolled included;
  - `kept`: kept faces;
  - `rolls`: for a roll made more than once, every whole roll in order, `{ total, kept, items }`,
    `total` before bounds and `kept` true for the one kept (whose items, faces and kept faces
    are the result's); absent for a roll made once;
  - `empty`;
  - `items`: the itemized roll;
  - `tallies`: each roll tally visible from the action's pack, by name (below);
  - `bounds`: each bound that changed the total, in order, `{ source, op, value }` (`[]` if
    none), and `unbounded`, the total before them;
  - `band`: the first band of `bands` whose `when` holds, with `roll` bound to this result. A set
    with a `value` evaluates it once first, with `roll` bound to this result, and
    its bands see it as `roll.value`;
  - `bandValue`: that value, when the step's set has one (the log entry records it too);
  - `bandSet`: the qualified ID of the band set the step classified by
    (`5e-srd-5.1:attack`), when the step has `bands` and a band held. An app
    names the band `bands.<set>.<band>.name` in the set's pack.
- **Roll tallies**: after the roll, each declared tally is summed from the roll
  effects that target it (`target: { rolls, tally }`) and match the roll as other roll effects
  do: from 0, every `add` in instance order, then the highest `atLeast`, then the lowest
  `atMost`. Stacking applies per tally and op, as for other roll effects. Tallies never change
  `total`, `faces` or `kept`. A tally nothing added to is 0.

### Classifying an earlier roll again

A roll step with `of` builds and rolls nothing and is not a checkpoint:

1. **The roll.** `of` is a path relative to the action (the running action's own prefix
   added): a roll step of the action, or of an action it ran (`check/roll`). In an `each` step,
   when the path's first step is an `each` step over the same role, it names that step's run for
   the current participant (`check[1]/roll`). A roll that didn't run (its step was skipped, or
   isn't reached yet) leaves the step without a result, as a false `when` does. At load, the
   path's first step must be a step of the action (`unknown-reference`, kind `step`).
2. **The result** is the earlier roll's `total`, `faces`, `kept`, `empty`, `items`, `tallies`,
   `bounds`, `unbounded` and `rolls`, with `band`, `bandValue` and `bandSet` worked out afresh by the
   step's `bands` in the step's band context (its flags, `params`, `steps`, `participants`, and
   in an `each` step `participant` and the participant's flags). A `split` may read it as it
   would the earlier roll.
3. **The log** gets an entry `{ step, action, kind: dice, by: engine, of, items, total, band?,
   bandSet?, bandValue?, summary }`, `of` the earlier roll's full path; no `faces`. Its summary is
   worked out as for any roll step, before the band.

### The roll summary

Every roll step has a **summary**: what the roll is rolled against, worked out
when the roll is built, before any face is rolled, in the step's band context (the running
action's `flags`, `params`, `steps`, `participants`, `situational`, fields and the rest:
everything but `roll`). It is output only: replay never reads it, and it never fails the action.

```yaml
summary:
  bandSet: mothership-1e:check # the step's band set, qualified; absent when it has none
  value: <text> # a set with `value`: that formula, resolved
  bands: # the bands that can still hold, in the set's order
    - band: success
      success: true # the set's success threshold, when the band marks it
      when: roll.total < 34 && roll.total < 90 # the condition, resolved
      tests: # when it's a conjunction of plain comparisons of the roll
        - { of: roll.total, compare: lt, value: 34 }
        - { of: roll.total, compare: lt, value: 90 }
  flags: { target: 34 } # the running action's flags at the step, as data
```

- **Resolving a condition.** Each maximal subexpression of a band's `when` (or the set's
  `value`) that doesn't read `roll` is evaluated and replaced by its value as a literal, and the
  tree is printed back with the standard printer, as a proposed change's action-time values are
  ([Changes steps](#other-steps)): strings quoted, lists as list literals, dice
  values in dice notation. Literal guards then decide as evaluation would: `false && x` is
  `false` and `true || x` is `true`; `true && x`, `false || x`, `x && true` and `x || false` are
  `x`; `c ? a : b` with a literal `c` is the taken branch; `!` of a literal is its negation. A
  subexpression that fails to evaluate, or gives a map (no literal), is left as written.
- **Which bands.** The set's bands in order, leaving out each whose resolved condition is `false`
  (it can't hold) and stopping after the first whose resolved condition is `true` (no later band
  can be reached). A set whose first band holds regardless of the roll (a `rolled` band when
  there's no DC) is summarized as that one band.
- **Success.** A band its set marks `success: true` has `success: true`: what the roll needs
  ([result bands](rules-and-fields.md#result-bands)).
- **Structured tests.** When a band's resolved condition is `true`, `tests` is `[]`. When it is
  a conjunction (`&&`) of comparisons each between a roll path (`roll.total`, `roll.value`,
  `roll.unbounded` or `roll.kept[<int>]`) and a number literal, `tests` lists them in order,
  the roll path on the left (`34 > roll.total` is `{ of: roll.total, compare: lt, value: 34 }`).
  `compare` is a code: `lt` (`<`), `le` (`<=`), `gt` (`>`), `ge` (`>=`), `eq` (`==`). Any other
  condition (`!=`, `%`, `||`, arithmetic on the roll, a function of the faces) has `when` only.
- **Wording.** The engine outputs codes and data, never display text. An app words a band's
  tests with the pack's optional `bands.<set>.<band>.condition` text (ICU arguments `value`, the
  first test's value, and `value1`, `value2`, … for each test in order), else the spec's
  `compare.<code>` text ([`i18n/en.yaml`](../i18n/en.yaml), argument `value`) per test.
- **Flags.** The running action's flags (of the action `needs.action` and the log entry's
  `action` name) at the step, each as data as `outcome.data` reports values (a dice value in
  dice notation); `{}` when there are none. Present on every roll, banded or not. Enclosing
  actions' flags aren't repeated: a panic check a save runs has the panic check's own.
- **Where it appears.** At a dice pause, `needs.summary`, for the roll the pause is for (a pause
  for more dice mid-roll carries the same one); on each roll log entry, a dice-less roll's
  included, `summary`, the same one.

**Previewing a roll.** No call previews a roll. To show what a roll is against before the player
rolls, an app starts the action with `policy: { dice: 'pause' }`, reads `needs.summary` from the
first dice pause and drops the paused result; startAction is pure, so nothing changes. Params,
participants and situational choices count as they would. The preview summarizes the first roll
the run reaches (an earlier roll in a nested action comes first, named by `needs.action`); a
choice step with no usable recommendation, an allocation or a handoff before it pauses first;
and a target set after the dice (Fate's opposition from an opponent's roll, read by a dice-less
step) appears only in that step's log entry. A pack that wants the target in the preview sets
it in a flag before the roll.

## Other steps

- **choice:** see [Choice steps](#choice-steps).
- **allocate:** see [Allocate steps](#allocate-steps).
- **branch:** the first case whose `when` holds, else `else`. Its `flags` are evaluated and set,
  then its steps run. A nested step's path is `<branch id>/<step id>`. With `each`, it runs per
  participant and its flags are per participant ([Each steps](#each-steps)).
- **changes:** a change with `forEach` is first repeated: its formula is
  evaluated to a list (`type-mismatch` otherwise), and the change is resolved once per element,
  in list order, with `x` bound to the element; an empty list proposes nothing. Each copy counts
  toward `maxActionSteps`. A change whose `when` is false (for each element, with `forEach`) is
  skipped. Each other proposed change is resolved:
  - formulas are evaluated (`value`, `by`);
  - a computed field (`field: { formula }`, `set` and `adjust` only) is evaluated
    to a string (`type-mismatch` otherwise) and qualified against the action's pack, as a
    literal field is. For `to: self` or a role it must name a field of the ruleset
    (`unknown-field`) that is an input (`not-input-field`), else the action fails (data:
    `field`: the string as computed, or for `not-input-field` the qualified ID). For a link it must be a qualified ID (`unknown-field`
    otherwise) and is passed on unchecked, as a literal one is;
  - `entry: self` becomes the action's entry; `entry: { formula }` is evaluated
    to an instance ID (anything but a non-empty string is `type-mismatch`) and passed on as
    written, for the actor, a role, a target or a link alike: the character receiving the
    change checks it as it would a written ID (`unknown-id`, …). `path.entry` may be computed the
    same way;
  - a `setState` or `adjustState` with `pick: self` becomes the `path` and `option` of the pick
    that activated the action's content, and one with `grant: self` the node (`entry`, or a
    pick's `path` and `option`) and `grant` of the holder grant that did
    ([dice-and-actions.md](dice-and-actions.md#actions)); `picks` and `grants` queries are passed
    on as written. `pick: owner` and `grant: owner` resolve the same way for the content the
    change is written on: in an added option's or a `changes` effect's changes, the pick or
    holder grant whose content carries the effect (content with saved state of its own: the
    pick or grant its `self` reads), else `unknown-reference` (data: `kind`, `id: owner`);
    elsewhere the action's content's, as `self`;
  - an `addItem` entry object is resolved: `item` is evaluated to a content ID and qualified against
    the action's pack; `quantity`, `equipped` and each `state` value are evaluated; `templates` are
    qualified; a pick's `option` given as `{ formula }` is evaluated to a string or number
    (`type-mismatch` otherwise), the rest of `choices` passed on as written. Without an `id`, the
    copy gets `<item local id with dots as hyphens>-<n>`, the smallest `n` ≥ 1 that the character
    and the action's earlier `addItem` changes don't use, so a replay gives the same IDs. An `item`
    that names no content, or a template, is the error `unknown-reference` (data: `id`), and a
    grant-only one `not-addable` (data: `item`; [content.md](content.md#grant-only-content));
  - an `applyEffect` has its `source` evaluated to a content ID and qualified
    against the action's pack, as an `addItem`'s `item` is (no content, or a template, is
    `unknown-reference`, data: `id`); `active` is evaluated to a boolean (`type-mismatch`
    otherwise) and each `state` value evaluated; `id` is passed on as written. Without `id`, the
    action picks none: applyChanges gives the entry its ID on the character receiving it
    ([engine-core.md](engine-core.md#applychanges)), so a change for a target needs no knowledge
    of the target's file. A `toggleEffect`'s `active` is evaluated the same way;
  - an `equip`'s `equipped` is evaluated to a boolean (`type-mismatch`
    otherwise), for the copy `entry` names or for every copy `copies` matches; an
    `applyTemplate`'s or `removeTemplate`'s `template` is evaluated to a content ID and qualified
    as `source` is, but must name a template (`unknown-reference` otherwise, data: `id`).
    `setExtension` can't be proposed: extension data is an app's;
  - an `offerFollowUp` names its follow-up: one the content declares (or its
    content type) whose added option or added changes propose it, else
    the content defining the action (`<item>#<action>`), else the rules (a local ID qualified
    against the action's pack). It is resolved to `{ type: offerFollowUp, followUp, source?,
    params? }`: the qualified follow-up ID (`<content>#<id>`, `<pack>:<type>#<id>`,
    `<pack>:<id>`), the content's source as computeSheet names it, and `params` evaluated (one
    giving `null` left out). It is proposed `to: self` whatever the step's `to`. A follow-up the
    owner doesn't declare, or a derived one, is `unknown-reference` (data: `followUp`);
  - `entry: picked`, in a choice step's `changes` over copies, becomes the picked instance ID;
  - a `choose` or `unchoose` resolves its `path`: `path.entry` like `entry` (`self`, `picked`
    or an instance ID; left out for a rules-level choice) and `path.choice` as written, or, given
    as a formula, evaluated to a list of strings (`type-mismatch` otherwise); `option` is
    evaluated;
  - a change aimed at copies (`copies: { type, where }`) has its `type`
    qualified against the action's pack and is passed on with `where`; its `by` or `value` is
    evaluated now unless it reads `self` or `item`, in which case it is passed on as a formula
    for applyChanges to evaluate per copy. A string value evaluated now is passed on as a quoted
    string literal;
  - a change aimed at applied entries (`applied: { where, limit? }`: a
    `removeEffect`, `toggleEffect`, `setState` or `adjustState`) is passed on the same way:
    `where` and a `by` or `value` that reads `self` or `item` as formulas, `limit` as written;
  - a formula that reads `batch` is passed on too: a `by` or `value` under
    `copies` or `applied`, and an `applyEffect`'s `state` value, which is passed on as
    `{ formula }` for applyChanges to evaluate with `item` the source's item, the receiving
    character's fields and `batch` ([engine-core.md](engine-core.md#what-the-batch-did));
  - a formula passed on (`copies.where`, `applied.where`, a `by` or `value` that reads `self`, `item` or `batch`, and an `applyEffect` state value that reads `batch`) may
    read fields, `self`, `item` and `character`, and also `steps`, `flags`, `params` and
    `action`. Those four are substituted now: each
    maximal name or member path rooted at one of them (index expressions inside the path included) is evaluated in the
    action and replaced by its value as a literal, and `has(<such path>)` by `true` or `false`.
    The tree is then printed back with the standard printer: strings quoted, lists as list
    literals, dice values in dice notation. A formula that reads none of them is passed on as
    written. A map has no literal, so a path to one is `type-mismatch`. A path that fails (a flag
    no case set is `no-such-key`) fails the action like any formula error, unless a substituted
    `has()` guards it: when a guard that is now a literal (`false && …`, `true || …`,
    `false ? … : …`, `!` of one) skips the operand holding the failed path, that operand is
    dropped with the guard (`has(flags.x) ? item.k == flags.x : true` becomes `true`), as
    evaluation would skip it. The returned change holds only names applyChanges knows, so a log
    shows the value (`'arrows'`), not the name (`flags.ammo`);
  - fields are qualified;
  - tags are evaluated.

  A `split` adjust becomes one change per tag group; its field is always written out (a computed
  one is a load error, `formula-error` with cause `type-mismatch`). The result is appended to
  `proposedChanges` as `{ to, step, change }`, where `step` is the path of the `changes` step
  (`deal`, `panic/stress`); the changes of one split adjust share it. A roll step proposes too:
  after it, each roll effect that changed the roll (with `when: applied`, that was in play on
  it) proposes its `then` changes, `to: self` or its rule's `to`, with the roll step's path,
  unless an earlier roll step of the run (a used action's included) already proposed that
  effect's; with `once: roll`, unless this roll step's run did. Changes for `to: self` are
  resolved as below; for another character, as a `changes` step's for that `to`, in the
  effect's context. They aren't held by a `hold` action step: they record a roll that was made
  ([effects.md](effects.md#targets), "Roll effects that end themselves").

  **Releasing held changes**. A step with `release` first proposes changes `hold`
  action steps hold, then its own `changes`, if any. For each step in `release.steps`, in order,
  each of its held changes in the order held: when `where` is given it is evaluated with
  `change` bound to the change's `change` record (as `proposedChanges` lists it, `tags` `[]`
  when it has none); a change it holds for is released, one it doesn't stays held. A step that
  didn't run, or holds nothing, gives none. With `combine: true`, released `adjust` changes
  whose `by` is a number and that are equal in everything else (their `to`, `character` and the
  rest of the change, `tags` in order) are merged: the first keeps its place with `by` the sum
  (decimals kept to six places), the others go. Each released change keeps its `step`.

  **Routing.** `to` is `self` (default), `target`, a declared role, or
  `{ link: <slot> }`.
  - A change for a link carries `to: { link: <qualified slot id> }` and, when the slot is
    filled, `character`: the linked character's ID. An empty slot's changes are proposed
    without `character`. Fields, copy types and `addItem` items in a change sent to a link are
    the linked character's qualified IDs and are passed on as written; its formulas are
    evaluated as usual, in the actor's context.
  - A change for a role (`target` included) carries `to: <role>` and `character`, the
    participant's view `id`: in an `each` step over that role, the current participant;
    elsewhere, the step's changes are resolved once and proposed to each participant in turn,
    all of the step's changes for the first, then for the next. With no participants they are
    proposed once without `character`, as before. Their fields and content are resolved in the
    action's pack, as for `self`, except that a field, content ID (an `addItem`'s `item`, an
    `applyEffect`'s `source`) or copy type qualified with a pack the ruleset doesn't load is
    passed on as written, as for a link: the participant's own `applyChanges`
    checks it. A local or bare ID still resolves in the actor's pack, and an unknown ID of a
    loaded pack is still `unknown-reference`. The build checks such references against the
    named pack when the repo has it.
  - The app applies each change to that character with `applyChanges`, so its own
    incoming-change effects, absorbing and overflow apply there.

- **Changes content adds**: a changes step's `tags` (computed entries
  evaluated when it runs, with the tags `action` steps running the action add after them, as for
  roll and choice steps) are matched by content's `changes` effects
  (`target: { steps: [<tag>], from? }`, [effects.md](effects.md#targets)). After the step's own
  `release` and `changes`, each active `changes` instance whose source is a content item, a
  template or the rules' effects (`item` and `self` unbound, `from: self` never matching), whose target tags match one of the step's (a tag matches itself and the tags below
  it), whose `from: self` (if any) names the action's own copy, and whose `when` holds, proposes
  its `changes`, in instance order, `to` its value's `to`, else the step's. Its formulas see what
  an added option's see: `item` and `self` the content carrying the effect (`entry: self` its
  copy), the action's own as `action.item`, `action.self` and `action.step` (the step's
  evaluated tags), and the action's `params`, `situational`, `steps`, `flags`, `participants`
  and, in an `each` step, `participant`. They are resolved as the step's own changes are, at the
  step's path (per participant in an `each` step), and held by a `hold` action step like any
  other. A step with no `changes` and no `release` (only `tags`) is a place content adds to;
  without matching content it proposes nothing.
- **The step's result** is `steps.<id>.added`: the instance IDs of the copies the step's
  `addItem` changes to `self` add, its own and those content adds, in the order proposed (`[]`
  for none). An ID the engine picked is listed as picked, so a later step can aim a computed
  `entry`, a `path.entry` or a pending choice step's `entry` at the new copy. Changes for another
  character, and held changes the step releases (they keep their own `step`), are left out.
- **action:** runs the used action with the evaluated `params`, the same character, entry,
  source and situational choices. Its steps' log entries are nested under `<step id>/`. Its outcome is
  `steps.<id>.result` and `steps.<id>.data`. Its proposed changes are appended to the parent's;
  with `hold: true` they are taken off again once it ends and held under the
  step, after any earlier run's, until a changes step releases them (above). The proposed sheet
  is then worked out afresh, without them. A pause holds nothing: a replay holds them again.
  With `as: participant` the step is a [handoff](#handoffs) instead. It also has:
  - **Parameters.** Each `params` formula is evaluated in the parent's context; one giving `null`
    leaves its parameter out, as if the app hadn't given it (an optional one takes its default
    or stays absent, a required one is `missing-param`). A field parameter given an object with
    a string `id` (a field parameter's view, `params.skillA`) takes that `id`. A dice value is
    passed as its canonical dice notation (`2d6 + 1`), which a `dice` parameter reads back as
    dice: a bomb's damage passes whole to the bomb Strike. A handoff's and a
    follow-up's `params` carry dice the same way. A handoff's and a
    follow-up's `params` leave out a `null` the same way.
  - **`source`.** Evaluated to a string (`type-mismatch` otherwise) and qualified against the
    action's pack as a content ID (kept as written when nothing matches). The action is `use`
    if it names a rules action, else `<source>#<use>` (an action the content or its type
    defines). The step reads `computeSheet`'s `actions` for the character on the step's sheet
    and takes the listing with that action and that `source`, or a listing with no `source`
    whose `entry` is a copy of that content (the content is its own item), the one with the
    parent's `entry` first, else the first in listing order; it runs as `startAction` would run
    that listing, with its `entry` and `source`. So a step finds a class added earlier in the
    run by its ID, as `entry` finds it by the new copy's ID. The listings here include actions with `listed: false`, which `computeSheet`
    leaves out. No such listing is `unknown-action` (data: `action`, `source`), so the used
    action's `available` must hold. Without `source` (or `entry`), the used action runs with the
    parent's entry and source, as before, and its `available` isn't checked: a helper action only
    other actions run declares `listed: false` (or `available: false`), so `computeSheet` never
    offers it.
  - **`entry`**. Evaluated to a string, an instance ID (`type-mismatch`
    otherwise). The step takes the listing of `computeSheet`'s `actions`, for the character on
    the step's sheet, with the action `use` (as above) and that `entry`, and with that `source`
    when the step gives one too (with neither, the listing has no `source`). Without `source`,
    a `use` that names no rules action is `<item>#<use>`, `<item>` the entry's own item (the
    copy's, or an applied entry's source): an action that item or its type defines. It runs as
    `startAction` would run that listing: that copy is `self` and its item `item`. No such
    listing (no such copy, the copy doesn't list the action, or its `available` is false) is
    `unknown-action` (data: `action`, `entry`, and `source` when given). Not on a handoff: its
    used action runs on another character, whose copies the actor doesn't know. A replay reads
    the same listing again.
  - **`participants`.** Each formula is evaluated to a list of strings (`type-mismatch`
    otherwise). Each must be the `id` of a participant of the running action, in any role
    (`invalid-participants`, data: `role`, the nested role). The nested action's roles are then
    built from those views as the app passed them, exactly as in [Starting an
    action](#starting-an-action) step 4: an undeclared role, or a count outside the role's `min`
    and `max`, is `invalid-participants`; an ID twice in the nested call is `duplicate-id`; each
    declared field is read from the view. Roles it doesn't give are `[]`.
  - **`tags`.** Evaluated in the parent's context and added, after their own and without
    repeats, to the evaluated tags of every roll step and choice step of the used action and
    of the actions it runs in turn (those add their own `tags` after these). Everything that
    reads those steps' tags sees them: roll effects, situational choices' effects, a choice
    step's added options and `action.step.tags`, and policy rules. Allocate steps don't get
    them.
  - **`situational`**. Maps situational choice IDs (qualified at load against
    the action's pack, as fields are; an unknown one is `unknown-reference`, kind
    `situational`) to formulas, each evaluated in the parent's context. The used action, and the
    actions it runs in turn, see the running action's situational values with these in their
    place, as if the app had selected them: formulas read them as `situational.<id>`, and a
    selected choice's effects apply to the rolls it is offered for. A value that doesn't fit the
    choice's type (a boolean, an integer, or one of an enum's `values`) is `wrong-type` (data:
    `target`, the qualified ID, and `expected`). Availability isn't checked: the pack says so.
    Not on a handoff (schema), where the participant's player answers their own.
- **outcome:** evaluates `result` (a string) and `data`, then finishes the action. Steps after it
  don't run. When the action declares `results`, a result that isn't listed (or, for
  `{ bands: <set> }`, isn't a band of that set) is the error `undeclared-result` (data:
  `result`), for a nested action too.

An action that ends without an outcome step finishes with `outcome: {}`.

## Each steps

A `roll`, `choice`, `changes`, `action` or `branch` step with `each: <role>` runs once per participant of the role, in input order:

- `participant` is bound to the current view, and `when` is evaluated for each participant.
  With no participants the step doesn't run, and `steps.<id>` is absent.
- The run for participant `i` has the path `<id>[<i>]` (`saves[1]`); its checkpoints, nested
  steps and log entries use it (`check[0]/check`). Policy `rules` match it by tags and by that
  path.
- `steps.<id>` is the list of per-participant results in participant order, null for a
  participant whose `when` was false. Inside a later `each` step over the same role, it is the
  current participant's result instead, absent when that participant was skipped. Inside the
  step's own run for participant `i`, `steps.<id>` is the list of the results of runs `0` to
  `i - 1`, null where `when` skipped one, and absent in the first run. A `split`
  in such a step reads the current participant's roll.
- A `branch` step with `each` picks its case per participant and keeps its
  `flags` per participant: inside a later `each` step over the same role, and in the case's own
  steps, `flags.<name>` is the current participant's value (absent where the branch set none);
  elsewhere it is the list in participant order, null for a participant the branch's `when`
  skipped or whose case doesn't set it. A flag a step sets without `each` later replaces the
  list. The case's steps run within the participant's run, at `<id>[<i>]/<step id>`; their
  results are lists by participant, as an `each` step's, and they may not have an `each` of their
  own (`unknown-role` at load). Cast-spell's outcome per target is one such flag.
- `outcome` steps don't take `each`; `maxActionSteps` counts each run.

## Group steps

A `group` step runs its `steps` in **passes**:

1. If its `when` holds, `repeat.max` is evaluated once, to an integer (`type-mismatch`
   otherwise). With a `max` of 0 or less, no pass runs and `steps.<id>` is `[]`.
2. **A pass.** Before pass `n` (from 0), the results of every step the group holds, at any
   depth, are cleared, so each reads as absent until it runs in this pass. The steps then run as
   any steps do, with paths `<id>[<n>]/<step id>`; a branch in the group nests under it
   (`reroll[1]/hit/damage`). `steps.<id>` is the list of finished passes before it.
3. **The pass's result.** Once its steps have run, the pass is the map of the results its steps
   set (a step that didn't run is left out), appended to `steps.<id>`.
4. **Again?** `repeat.while` is evaluated, with this pass's results as `steps.<step id>`.
   Another pass runs while it holds and fewer than `max` passes have run. A pass past the
   safety limit `maxGroupPasses` fails the action with `safety-limit-exceeded` (data: `limit`);
   each pass after the first counts toward `maxActionSteps` too.
5. **Afterwards**, each step the group holds reads as its latest result, from the last pass that
   ran it, or is absent when none did; a roll step's `of` naming one (`of: again`) takes that
   run, and inside a pass it takes this pass's.

Checkpoints in a pass are matched by the policy's `step` rules at their pass path, and replay
consumes answers in order, as for any step. `outcome` inside a group ends the whole action. A
group holds no other group (`pnpm validate` reports one at any depth) and has no `each` or
`sheet`; inside an `each` branch's case its passes run per participant, its result a list per
participant as the case's steps' are.

## Handoffs

An `action` step with `each: <role>` and `as: participant` is **handed off**: the
participant runs the used action on its own character, and the engine doesn't run it.

1. Its `params` are evaluated in the actor's context. The used action (`use`, qualified at
   load) must exist in the ruleset (`unknown-action`), and types them: a missing required one
   is `missing-param`, a wrong type `wrong-type`, a number outside a number-literal `min` or
   `max` `out-of-range`. A bound written as a formula reads the participant's character, so it
   is checked when the participant's action starts.
2. Its `participants`, when given, are evaluated as an `action` step's
   ([above](#other-steps)), except that an ID may also be the running character's own `id`
   (`character.id`). The used action's roles check them: an undeclared role, a count outside
   the role's `min` and `max`, or an ID that is neither a participant of the running action nor
   the running character is `invalid-participants` (data: `role`); an ID twice is
   `duplicate-id`.
3. Without a recorded answer, the action **pauses** with `needs`: `kind: handoff`, `step` (the
   indexed path), `action` (the defining action), `participant` (`{ role, id }`) and
   `run: { action, params, participants? }`, `participants` the evaluated IDs by role (only the
   roles given). A handoff always pauses: the policy doesn't apply.
4. The app runs `run.action` on the participant's own character, with that character's packs,
   situational choices, policy and dice, and with a view of each character `run.participants`
   names (from that character's own computed sheet, as for `startAction`), and answers
   `continueAction` with the finished `outcome` (`{ result?, data? }`). A `result` the used
   action doesn't declare is `answer-mismatch`. If the participant's packs lack the action, what the app runs instead is
   its business.
5. The step's result is `steps.<id>.result` and `.data`, as for a nested action. The handed-off
   run's proposed changes are the participant's, for the app to apply; the actor sees only the
   outcome.

## Choice steps

A choice step has one source of options (a fifth, pending choices, is
[below](#choice-steps-over-pending-choices)):

| `options`                                       | Offers                                                                                                           | Option ID                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------ |
| a list `[{ id, when?, changes?, to?, flags? }]` | the written options whose `when` holds, in written order                                                         | the written `id`         |
| `{ content: { type, where? } }`                 | the ruleset's content of `type` (qualified against the action's pack), in content order, hidden content left out | the qualified content ID |
| `{ copies: { type, where? } }`                  | the character's copies of `type`, inventory then features, each in file order                                    | the instance ID          |
| `{ values, where? }`                            | the written values, or the strings and numbers a `{ formula }` gives, in list order, each once                   | the value as a string    |

- **Added options**. A step with `tags` also offers, after its source's
  options, the options content adds: each of the character's active `option` effects (in
  instance order, as for roll effects) whose target tags match one of the step's evaluated tags
  ([tag matching](effects.md#tag-matching)), whose `from: self`, if given, names the action's
  entry, and whose `when` holds. Its ID is `<content id>#<option id>`, the content being the item
  whose copy, pick or grant carries the effect, or `<pack>:rules#<option id>` for the rules'
  effects (`item` and `self` unbound; `from: self` never matches). Of the effects sharing a `stackKey` (`source`: the
  same source, as for stacking), only the first offered is; an ID offered already (two copies
  of one item) is offered once. Its `when` and `changes` see the action context with `item`,
  `self` and the content's other roots the effect's, `action` the action's own (`action.item`,
  `action.self`, `action.step`) and, in `when`, `picks`. A situational choice's and a choice's
  effects add no options. Nothing else changes for a step without `tags`.
- **Candidate formulas.** A written option's `when` sees the action context and `picks`. A query
  source's `where` and `prefer` see the action context with `item` the candidate's item view,
  `self` the candidate copy (copies only; over content `self` isn't bound), `picks` and
  `action`. A value source's `values` formula sees the action context; its `where` and `prefer`
  see it with `value` the candidate value, `picks` and `action` (`item` and `self` stay the
  action's own). `picks` is how many times this step has already picked the candidate. A
  `values` formula that fails is an error, as any action formula is, and a list element that
  isn't a string or number is `type-mismatch`; two values with the same string form (`1` and
  `'1'`) are offered once, the first.
- **Each pick is a checkpoint.** Before each pick the options are worked out again. With no
  `repeat` the step picks once. With `repeat: { max, min? }` (both evaluated once, before the
  first pick; `min` defaults to 0) it picks until it has `max` picks, nothing is offered, or
  `#done` is picked. Once it has `min` picks, the reserved option `#done` is offered last;
  picking it ends the step. An option may be picked again while its `when` or `where` holds.
- **Nothing to offer.** A step with nothing to offer on its first pick is skipped: it isn't a
  checkpoint and logs nothing. Without `repeat`, `steps.<id>` is then absent
  (`has(steps.<id>)` is false); with it, `steps.<id>.picked` is `[]`.
- **Recommending.** `recommend` is evaluated before each pick, with `options` bound to the IDs
  the step's own source offers (`#done` and added options left out); it recommends its value if
  that is one of them, else nothing. Without `recommend`, a `content`, `copies` or `values` step
  recommends the candidate with the highest `prefer` (a number; ties go to the earlier
  candidate). A step with neither recommends nothing, whatever its source and however many
  candidates it offers: the first candidate is never recommended by default, so
  `needs.recommended` is absent and an automatic run pauses there. A pack that wants the first
  says so with `recommend: options[0]`. `#done` and added options are never recommended, so a
  step offering only added options pauses.
- **Random picks**. `random`, a condition, is evaluated before each pick in the
  same context as `recommend` (with `options`). When it holds and the source offers two options
  or more, the engine **draws**: one die with as many sides as the source's offered options
  (added options and `#done` left out), and recommends option `face − 1` in the order offered,
  instead of `recommend` and `prefer`. With one option, that option is recommended and nothing is
  drawn. The draw is a dice checkpoint at the step's path, before the pick's own checkpoint: the
  policy decides it as a roll matched by the step's evaluated tags (`kind: roll`), a recorded
  face is replayed, and a pause is `needs.kind: dice` with `dice: [{ count: 1, sides }]` and
  `draw: { among }`, the option IDs the faces name. Its log entry is `kind: dice` with the one
  face in `faces` and the same `draw`. A face not on the die is `answer-mismatch`. The pick
  itself is then decided as any other: the player may still pick another option. A creation
  action shared by a guided and a random start says `random: params.random`.
- **Result.** `steps.<id>.picked` is the option ID; with `repeat`, the list of picked IDs in
  order, `#done` left out, updated after each pick. Over content or copies without `repeat`,
  `steps.<id>.item` is the picked content's item view (the view `item` gives an action of that
  content), and over copies `steps.<id>.self` is the picked copy's view; over values without
  `repeat`, `steps.<id>.value` is the picked value. Over values with `repeat`,
  `steps.<id>.values` is the list of picked values in pick order, each as the source gave it (a
  number stays a number), updated after each pick like `picked` (`[]` before the first);
  added options picked leave nothing in it. When an added option is picked, `.item`, `.self` and
  `.value` are absent.
  `steps.<id>.added` lists the copies the step's changes add to `self`, every pick's in order,
  as a changes step's does (above); it is updated after each pick's changes, so with `repeat` a
  later pick's changes see the earlier picks' copies.
- **Flags**. A written or added option may have `flags`
  (`{ <name>: <formula> }`). After each pick (not `#done`), before any changes, the picked
  option's flags are evaluated in order, each with `picked` bound and the earlier ones already
  set, and set as `flags.<name>`, as a branch case's are: a written option's in the action's
  context, an added option's in its own (`item` and `self` the effect's, `action` the action's
  own). A flag already set, by a branch or an earlier pick, is replaced; with `repeat`, each pick
  sets its flags in turn. The option's own changes, the step's changes and every later step read
  them. An added option may set only flags its action sets elsewhere, in a branch case or a
  written option, so every flag stays declared by the action: at load, for each action in the
  option's pack scope with a choice step whose written tags match the option's target, a flag
  that action doesn't set is `formula-error` with cause `unknown-name`, and a value whose type
  is none of the types the action sets it to is `type-mismatch` (`dyn` sets accept any type).
  Packs give such a flag its default in an early branch.
- **Changes.** After each pick (not `#done`), the picked option's own `changes` (a written or
  added option's, with its `to`, default `self`), then the step's `changes` (with `to: self`),
  are resolved like a `changes` step's at the choice step's path and appended to
  `proposedChanges` right away. Their formulas see `picked`: `{ id }`, plus `item` over content
  and copies, plus `self` over copies, plus `value` over values (absent for an added option). In
  a written option's and the step's changes `item` and `self` stay the action's own; in an added option's they are the
  effect's, `entry: self` names the effect's copy and fields and content are resolved in the
  effect's pack. `entry: picked` names the picked copy. Since the action never applies its
  changes, a budget sees earlier picks through `picks`, or, with `sheet: proposed`, on the
  [proposed sheet](#the-proposed-sheet), built again before each pick.
- **Policy.** Each pick is decided by the policy like any choice, matched by the step's
  evaluated `tags`. Under `auto` the engine takes the recommendation; with none, it pauses.

### Choice steps over pending choices

A choice step with `options: { pending: { entry? } }` asks the choices that
content brings, without naming them. `entry`, a formula giving an instance ID, limits it to the
choices whose path starts at that copy. `path` instead (`{ pending: { path } }`) limits it to
the choices at or under a choice path: it is resolved once, before the first pick, as a
`choose`'s `path` is (`entry` an instance ID, `self` or `{ formula }`, left out for rules-level
choices; `choice` a list of segments or a formula giving one), and a pending choice is asked
when it has the same `entry` and its choice path starts with `choice`. With neither, every
pending choice is asked, rules-level ones included. Each pick is a checkpoint:

1. The step reads the [proposed sheet](#the-proposed-sheet), built again before each pick, as if
   it had `sheet: proposed`. (`sheet: given`, `repeat` and `prefer` aren't allowed on this
   source.)
2. Of the sheet's pending choices, in `computeSheet`'s `pending` order and filtered by `entry` or `path`,
   **the choice** of this pick is the first with at least one option that `listOptions` calls
   eligible and that isn't picked yet. A choice whose options are all ineligible is passed over
   for now: a pick that makes them eligible brings it back.
3. The options are those, in `listOptions` order, each named as `listOptions` names it (a
   qualified content ID, an inline option ID, or a value as a string), then `#done`, unless the
   character on the proposed sheet is being created (`creating`): every pending
   choice is below its `min`, so skipping one would leave `finishCreation` refused
   (`creation-incomplete`) and the action's whole batch with it. An answer of `#done` there is
   `answer-mismatch`, as for any option not offered.
4. With no such choice the step ends; on its first pick it is skipped, as a step with nothing to
   offer is (`steps.<id>.picked` is `[]`).
5. **Recommending.** The step's `recommend`, if given, with `options` bound to the options
   (without `#done`) and `choice` to the choice's `{ path, owner, id }`, plus `slot` for a slot
   of a slotted choice (`has(choice.slot)`); else the option
   `listOptions` marks recommended (the choice's own `recommend`); else none, and the step
   pauses. `#done` is never recommended. `random` sees `options` and `choice` too; when it
   holds, the pick's option is drawn among the options, as above, and a draw's
   dice pause also carries `needs.choice`.
6. **The pick** proposes `{ type: choose, path: <the choice's path>, option: <the option> }` to
   `self` at the step's path, then the step's own `changes`, whose formulas see `picked`:
   `{ id, path }`. `#done` ends the whole step, not just the choice being asked: every choice
   still pending stays pending, for a later step to ask ("skip the rest"); it is
   offered only outside creation. To end one choice early, the app answers its picks; a choice with
   `min` picks is no longer asked.

The result is `steps.<id>.picked`, the picked option IDs in order (`#done` left out),
`steps.<id>.paths`, their choice paths, and `steps.<id>.added`, the copies its changes add, as
for other choice steps. Policy rules match the step by its tags and path, and
`maxActionSteps` counts each pick.

**Pausing.** `needs.choice` is the choice being asked: `path`; `owner`, the key root of the
choice's owner, qualified (the content ID, `<pack>:rules` for a rules-level choice, and for a
choice nested in an inline option the owner's root plus `.choices.<choice>.options.<option>`);
`id`; and `min` and `max`, its evaluated pick counts as `listOptions` gives them
(`max` absent when unbounded), and `picked`, how many picks it has on the proposed sheet, this
step's earlier picks of it included, so an app shows "pick 2 of 6". Formulas (`recommend`,
`random`) see `choice` as `{ path, owner, id, slot? }` only. The app names the question with the choice's own text
(`<owner>.choices.<id>.prompt`) and the options as it names `listOptions` results, so the step
needs no text of its own. A slot of a slotted choice is asked by its own key
(`id: class-feat-2`) and carries `slot: { choice, number }`: the app names it with the declared
choice's prompt, `<owner>.choices.<slot.choice>.prompt`, filling `{slot}` with `number`. A
choice nested in a slot's inline option has the declared ID in its `owner`. The log entry records `choice`, the path, with the `option` and
`index`. On replay a recorded pick whose `choice` is no longer the one asked, or whose option is
no longer offered, is `answer-mismatch`.

## Allocate steps

An allocate step is one checkpoint that hands amounts to several fields.

1. **The fields.** Every integer input field of the ruleset (any loaded pack) whose view
   (`item`: `id`, `type`, `tags`, its tags on the sheet) matches `fields.where`,
   in the ruleset's field order (packs in
   load order, then each pack's rules files in path order). With none, the step is skipped: no
   checkpoint, no log entry, and `steps.<id>` is absent. `fields.where` is evaluated per field
   when the step runs, with `item` the field's view and the action's context, as in a choice
   step's content query: the character's fields, `self`, `character`, `links`,
   `params`, `situational`, `participants`, `steps`, `flags`, and `action` (`action.item`,
   `action.self`, `action.step`), the action's own item being `action.item` since `item` is the
   field. A query that reads only `item` may be resolved once, at load.
2. **What may be given.**
   - **Budget:** `budget` is evaluated once. A field with a `max` takes at most `max` less its
     input value. For each field, `limit`, when given, is evaluated with `field` bound to
     `{ id, value }` (the qualified ID and the field's computed value before the step) and bounds
     it further: the smaller of the two applies. A field with neither has no
     limit; one whose bound is 0 is still offered, with `limit: 0`.
   - **Values:** each of `values` is evaluated once. There are no limits.
3. **Checking amounts** (an answer, or a recommendation). Amounts are whole numbers by qualified
   field ID; a field left out gets nothing. They fit when every field is offered and:
   - **budget:** no amount is negative or over its field's limit, and the total cost, the sum
     of `cost` for each non-zero amount (`field` and `amount` bound; default the amount), equals
     the budget (`spend: all`, the default) or is at most it (`spend: upTo`);
   - **values:** the amounts, as a list, are the values in some order: each value used exactly
     once, so no field gets two and none is left over.
4. **Recommending.** `recommend` maps field IDs (qualified at load) to integer formulas. The
   amounts it gives are the recommendation when they fit; otherwise there is none.
   **Random amounts**: when `random`, a condition in the action's context,
   holds, the recommendation is drawn instead, each draw a die over the fields it may go to, as
   a choice step's draw is (a dice checkpoint at the step's path; a pause gives `draw.among`,
   the field IDs in field order; one candidate is taken without a draw):
   - **values:** each value in order goes to a field drawn among the offered fields not given
     one yet;
   - **budget:** one unit at a time goes to a field drawn among those that can take one more:
     the amount stays within its limit, and the unit's added cost (`cost` of the new amount less
     that of the old) is positive and no more than what is left of the budget. It stops when
     the budget is spent or no field can take another unit. Amounts that don't fit (some of a
     `spend: all` budget left over) are no recommendation, so the step pauses; the draws stay
     in the log.
5. **The checkpoint.** A recorded answer is checked again on replay (`answer-mismatch` if it no
   longer fits). Otherwise, under `auto` with a recommendation, the engine takes it; else the
   action pauses with `needs.kind: allocate` and `needs.allocate`: `fields`, `budget` and
   `spend`, or `values`, and `recommended` when there is a recommendation. Each field is
   `{ id, value, input, limit?, costs? }`:
   - `value`, the computed value before the step, and `input`, the input value before the step
     (saved, else the default), before effects: an amount adds to `input`, and
     `value` less `input` is what effects add ("8 + 7 point buy + 2 racial");
   - for a budget only, `limit`, the bound that applies, and `costs`:
     `costs[n]` is what an amount of `n` costs (`costs[0]` is 0), from 0 to `limit`, or to the
     budget when there is no limit, and to 100 at most; it stops before an amount whose cost
     fails to evaluate. `cost` sees only `field`, `amount` and the action's context, fixed while
     the step runs, so the total of any amounts is the sum of `costs[amount]`: an app shows
     what is left of `budget` without the formula. An amount past the array may still be
     answered and is checked as usual. Nothing is spent before the answer.
6. **Result.** `steps.<id>.amounts`: the amounts that do something, in field order (non-zero
   amounts for a budget; every given value). A budget step proposes one `adjust` (`by` the
   amount) per such field, a values step one `set` (`value` the value), `to: self`, at the
   step's path, in field order.

## Checkpoints and the policy

Roll, choice and allocate steps are **checkpoints** (a roll with no dice items isn't; see
[Rolling](#rolling)). The policy decides whether each continues on
its own (`auto`) or pauses (`pause`); a [handoff](#handoffs) is a checkpoint that always pauses:

1. The first matching `rules` entry decides. An entry matches by `kind`, by `tags` (any of the
   roll's or the choice step's tags, with those an `action` step adds), and by `step` (the step's
   path).
2. Otherwise the default applies: `dice` for rolls, `choices` for choices, `allocations` for
   allocate steps. Each defaults to `auto`. A rule's `kind` is `roll`, `choice`
   or `allocate`.
3. A choice or allocate step without a usable recommendation always pauses.
4. Each pick of a repeated choice step is its own checkpoint.

**What a pause names.** `needs.step` is the step's path. `needs.action` is the qualified ID of
the action that defines the step: `mothership-1e:panic-check` for the panic check a stat check
runs as `panic/panic`; `<item id>#<action id>` for an action defined inline on an item; the used
action's ID for an action reached through `use`. The app builds the step's text keys from it
(`<actionKey>.steps.<last path segment>.*`, `<actionKey>.options.<id>.name`). An
option added by content is named by its own item instead (`<contentId>.options.<option id>.name`,
from the ID `<content id>#<option id>`).

**Pausing for dice.** `needs.dice` lists the dice to roll, in item order (`count`, `sides`,
`zero`, `tags`), `needs.items` shows the built roll, and `needs.summary` what it is rolled
against ([The roll summary](#the-roll-summary)).

- The app answers with one face per die, in that order.
- If rolling needs more dice than that (a reroll, an explosion), the action pauses again,
  needing one die at a time.
- A wrong number of faces, or a face not on the die, is `answer-mismatch`.

**Pausing for a choice.** `needs.options` (with `#done` last once a repeated step has its `min`
picks, and on every pick over pending choices) and `needs.recommended`, present only when the
step recommends an option (above); over pending choices,
`needs.choice` (above); over values, `needs.content`, the qualified ID of the content the action
runs for (its `item`: the copy's item, the picked or granted content, an applied entry's
source), absent when it runs for none, also on the step's random draws. The app names each
value by `<content>.options.<value>.name` first ([i18n.md](i18n.md)). The app answers with one option; an option not offered
(`#done` before `min` picks included) is `answer-mismatch`.

**Pausing for an allocation.** `needs.allocate` (above). The app answers with `{ amounts }`; amounts
that don't fit are `answer-mismatch`.

**Pausing for a handoff.** `needs.participant` and `needs.run`. The app answers with
`{ outcome }`.

## The log and replay

Every checkpoint adds a log entry:

- `step` (the path);
- `action` (the defining action, as in `needs.action`);
- `kind` (`dice`, `choice`, `allocate` or `handoff`);
- `by` (`engine` or `app`);
- the `faces`, `option` or, for an allocation, `amounts`; for a random draw on a choice or allocate
  step, `kind: dice` with its one face and `draw: { among }`; for a handoff (`kind: handoff`, `by:
  app`), the `participant` and the `outcome`;
- for each pick of a choice step with `repeat` or over pending choices, `index`: 0 for its
  first pick, then 1, 2, …; the entries share the step's path; over pending
  choices, also `choice`, the path of the choice the pick answered;
- for rolls, the `items`, `total`, `band` and `bandSet` (as in the step's result), and `tallies`:
  each tally with a non-zero value as `{ name, value, sources }`, each source `{ source, op, value
  }` (an `atLeast` or `atMost` is listed only when it changed the value); `bounds`, when a bound
  changed the total; `rolls`, for a roll made more than once (as in the step's result), while
  `faces` lists every roll's faces as supplied; and `summary`, the roll's [summary](#the-roll-summary), a dice-less roll's
  included.

**A paused action is its inputs plus its answers so far** (`state`): the ruleset version, the
character, the action, params, situational choices, link views, participants, and every
checkpoint's faces, option, amounts or handoff outcome,
including those the dice function supplied. `continueAction` adds the new answer and **replays**
the action from the start, using recorded answers in order, until it finishes or reaches a
checkpoint with no recorded answer. A repeated choice step consumes its recorded options in
order, one per pick, and handoffs their recorded outcomes. A recorded option that is no longer offered when replayed is
`answer-mismatch`. Replay is exact because the engine is deterministic given its
answers. That is also what makes a whole run replayable from its inputs and answers (below).
**PROVISIONAL** internal shape: `state` is plain JSON, and only its meaning is fixed.

## Replaying from answers

An app that can't trust a paused `state` coming back from a client (it embeds the whole
character) keeps only the answers and replays them against its own copy of the character.
startAction's `answers` does that in one call:

1. **The answers.** A list, one per pause in order, each exactly what continueAction takes for
   that pause: `{ faces }` (one face per die of `needs.dice`; a reroll or explosion that pauses
   again for one die is its own answer), `{ option }` (each pick of a repeated choice step,
   `#done` included), `{ amounts }` or a handoff's `{ outcome }`.
2. **The result** is exactly what startAction without `answers`, then continueAction with each
   answer in turn, would return, with the same inputs, startAction's `policy` for every pause
   and the same dice function: finished; paused at the first pause the answers don't reach
   (`needs`, `state` and `log` as the loop leaves them, so continueAction carries it on); or a
   failure. Omitted or `[]`, startAction runs as without it.
3. **A mismatch.** An answer that doesn't fit its pause, by any of continueAction's checks
   ([Checkpoints and the policy](#checkpoints-and-the-policy); an answer of the wrong kind
   included), is `answer-mismatch` with `data.index` (its index in `answers`, from 0),
   `data.needs` (the pause it was given to) and `data.reason`. Later answers aren't read. An
   answer left over once the action finishes is `answer-mismatch` with `data.index` and no
   `needs`. Any other failure is returned as the loop would return it.
4. **Dice.** Only pauses take answers. A checkpoint the policy runs itself asks the dice
   function, in the order the loop would. To get the same rolls on every replay, pause dice
   and keep the faces with the answers, or pass a dice function that repeats its faces (a
   seeded one).
5. **Not the log.** The log lists the checkpoints the engine ran itself (`by: engine`) and
   merges a roll's pauses into one entry, so it isn't the answers; apps keep the answers they
   sent.

An engine may run the loop or replay once with every answer, as long as the result is the
same.

## Details

These follow from the rules above; they are spelled out because engines have to agree:

- **Item order:** a roll's items are its parts in order, then `add` effects in the character's
  instance order (the rules, features with their picks and grants, inventory with its templates,
  applied effects), then the selected situational choices' effects. Dice items roll in this
  order, so it decides which supplied face goes to which die (the d20, then Bless's d4).
- **Item sources:**
  - A `dice` part takes the action's owner: `{ type: item, id, entry }` for a copy's action,
    `{ type: rules, id }` for a rules action.
  - A `field` part, and a `value` part that is a single field name, take the field.
  - An `add` effect's item takes the effect's source: `item` or `template` with the copy's
    `entry`, or `item` for an applied effect such as Bless.
  - A pool die added by a situational choice records `{ type: situational, id }` as its face
    source.
- **`kept`** holds the kept faces of every dice item in order, so `steps.attack.kept[0]` is the
  d20 even when Bless adds a d4.
- **Split:** a split adjust emits one change per group, in the order the groups first appear
  among the roll's items.
- **Paths:** a step inside a branch is `<branch>/<step>` (`hit/confirm`); a nested action's step
  is `<action step>/<its step>` (`check/check`); an `each` step's run for participant `i` is
  `<step>[<i>]` (`saves[1]`); a step in a group's pass `n` is `<group>[<n>]/<step>`
  (`reroll[1]/again`).
- **Outcomes:** an outcome step without `data` gives `{ result }` only.
- **Log `by`:** faces supplied by the dice function stay `by: engine` when the action is replayed
  after a pause.

## Errors and limits

- **Errors:** the result is `{ ok: false, errors }` with:
  - `unknown-action`, `missing-param`, `wrong-type`, `out-of-range`, `invalid-option`;
  - `invalid-participants`, `duplicate-id`, `invalid-link-value` (participants);
  - `undeclared-result`;
  - `unknown-field`, `not-input-field` (a computed field; a roll part's `field`);
  - `answer-mismatch` (from replayed `answers`, with `index` and `needs`);
  - `proposed-changes-failed` ([the proposed sheet](#the-proposed-sheet));
  - `conflicting-roll-modifiers`;
  - `safety-limit-exceeded` (`maxActionSteps`, `maxActionDepth`, `maxGroupPasses`, dice limits);
  - a formula's error code.
- **Other characters:** the engine computes one character per call. Another
  character taking part is a participant, passed as a view (`participants`), and anything that
  must run on its own sheet is handed off. A lasting other character, such as a crew, is a link
  slot: its view is an input (`links`) and its changes go `to: { link }`. Lists
  over participants' outcomes (a group action's best result) aren't expressible yet.
