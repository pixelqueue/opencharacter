# Effects

An **effect** ([`effect.schema.json`](../schemas/effect.schema.json)) is how active content changes the character. It applies while the content carrying it is active ([content.md](content.md#when-content-is-active)) and its `when` condition is true.

```yaml
# Gauntlets of Ogre Power
effects:
  - target: abilities.str.score
    op: atLeast
    value: 19
    when: self.equipped && self.attuned
```

| Property     | Meaning                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | Optional, unique within the item, so apps and issues can point at it                                                              |
| `target`     | A field (by ID or a formula), a set of fields, rolls, incoming changes, or choice steps (see below)                               |
| `op`         | One of the [effect operations](../data/effect-operations.json)                                                                    |
| `value`      | A formula, a grant value, a roll modifier, or an option, depending on `op`                                                        |
| `when`       | Condition. `self` is the copy carrying the effect. The item's or its type's `effectsWhen` must hold too                           |
| `stackKey`   | See [Stacking](#stacking)                                                                                                         |
| `rounding`   | Overrides the game's rounding for this effect's `multiply`                                                                        |
| `tags`       | `add` on rolls only: tags for the roll item the effect adds (see below)                                                           |
| `multiplied` | `add` on rolls only: `false` keeps `multiplyDice` and `multiply` off the items the effect adds (see below)                        |
| `duration`   | Informational only: `{ amount, unit, concentration }`. Time tracking is the app's job; the engine never ends an effect by itself. |
| `then`       | Incoming changes and rolls only: changes to the effect's own entry or state once it counted, or on rolls a rule (see below)       |

## Targets

- **A character field**, given by field ID: `target: combat.ac`.
- **A field a formula names**: `target: { formula: "'skills.lore.' + pick.value + '.granted'" }`.
  The formula gives a field ID as a string, resolved in the effect's pack. It is evaluated when
  the effect becomes active, as an activation condition: it reads `self`, `item`, `pick` and
  `slot` where they are bound, the character functions, the owner's picks and input fields only,
  never a derived field (`unknown-name` at load), so the field is known before any is computed.
  The effect is then exactly as if written with that field as its `target`, for its `when`,
  value, stacking, dependencies and listing. An empty string targets nothing. On the sheet, a
  value naming no field is `unknown-field` (data `field`, `where`), and a field the op doesn't
  take (`grant` into a field that isn't a `set`; `add`, `multiply`, `atLeast` or `atMost` on one
  that isn't a number, or for `add` a dice field) is `type-mismatch`; either way the effect
  targets nothing. One value choice's effects then reach the field its pick names:

  ```yaml
  # orc-sf-2e, Additional Lore: trained in the Lore picked, with its extra increases.
  - id: lore
    from: { values: [academia, alcohol, android] }
    effects:
      - { target: skills.trained, op: grant, value: { formula: "'skill.lore.' + pick.value" } }
      - target: { formula: "'skills.lore.' + pick.value + '.granted'" }
        op: add
        value: '(level >= 3 ? 1 : 0) + (level >= 7 ? 1 : 0) + (level >= 15 ? 1 : 0)'
  ```

- **A set of fields**: `target: { fields: { where: "'attr.dex' in item.tags" } }`. `where` is a
  condition over each field's view as `item` (`id`, the qualified ID; `type`; `tags`, its declared
  tags), and it may read nothing else (`unknown-name` at load), so `loadRuleset` resolves it once,
  over the merged ruleset: a homebrew field with the tag joins. In a choice's `effects` it may also
  read the pick, `pick` (and `slot` in a slotted choice or its inline options), so it is resolved
  for each pick: a skilled human's `where: "'skill-rank' in item.tags && pick.value in item.tags"`
  is the picked skill's rank. A field whose tags are computed
  ([rules-and-fields.md](rules-and-fields.md#tags-from-a-formula)) is matched on each sheet instead,
  by its tags there: the effect has an instance on it on that sheet when `where` holds, and none
  otherwise (`effects` doesn't list one). It matches `integer` and `decimal` fields only, and its
  ops are `add`, `multiply`, `atLeast` and `atMost`; or `grant`, which matches `set` fields only and
  grants its value into each, so a slotted choice grants each pick into its slot's set:

  ```yaml
  # orc-2e, content/features/spellcasting/repertoire.yaml: a spell known at the slot's rank
  - target:
      fields: { where: "item.id == 'orc-2e:spells.repertoire.rank' + string(slot)" }
    op: grant
    value: { formula: pick.id }
  ```

  A query that matches no field is not an error. The effect is one **instance per
  matching field**, in ruleset field order, each exactly as if the effect were written with that
  field as its `target`: same source, `when`, `value`, `stackKey`, `scope` and `rounding`. So it
  stacks and competes per field, each field's breakdown lists it, and computeSheet's `effects`
  lists each instance with its field as `target`. An instance's competing-option ID is the
  effect's with `@<field>` added (`<content id>#<effect>@<field>`). Each instance adds the
  dependencies an effect on its field adds: an effect on every check whose `value` reads a check
  is a loop on that check (`circular-formula`).

  ```yaml
  # orc-2e, content/conditions/frightened.yaml: a status penalty to every check and DC
  - target: { fields: { where: "'check' in item.tags || 'dc' in item.tags" } }
    op: add
    value: -self.value
    stackKey: status-penalty
    scope: applied
  ```

- **Rolls as they happen:** `target: { rolls: [attack, damage], from: self }`. The effect applies to any roll carrying one of the tags, in an action written by a pack that meets its own over that tag ([Which packs a tag target reaches](#which-packs-a-tag-target-reaches)). `from: self` limits it to rolls made by the item carrying the effect (a +1 weapon): the action's copy, and for an action run for content granted or picked under the copy (named by `source`) that content, so abilities a class grants that share their type's action each reach only their own rolls (a template is part of its copy, so its own action matches by the copy, as the copy's item's does; a nested `action` step keeps its `source`); `from: any` (the default) covers every matching roll the character makes (Bless). Roll effects add items to the itemized roll or modify its dice, and `atLeast` and `atMost` bound its total once it is rolled (see below). With `tally: <name>`, the effect adds to one of the roll's tallies instead (see below). With `band: value`, an `atLeast` or `atMost` bounds the value of the roll's band set instead (see below). With `parts: [<tag>]`, it reaches the roll's own parts carrying a matching tag instead of the whole roll: a `set` replaces them, and a `stepDie` or `setFaces` roll modifier changes only their dice (see [Replacing a roll's part](#replacing-a-rolls-part)). Its formulas see `item` and `self` as the content carrying the effect, the roll as `roll`, the action's own item and copy as `action.item` and `action.self`, and the running action's `params` (those `params` effects add included), `situational`, `steps`, `flags`, `participants` and, in an `each` step, `participant`, so Bracers of Archery test their own copy while a bow attacks.
- **Incoming changes:** `target: { incoming: { fields: [hp.current], tags: [damage.fire] } }`. The effect modifies the amount of an `adjust` change aimed at this character before it is applied, so apps don't apply resistances themselves. Both filters are optional; omitting both matches every incoming adjustment. After these effects, the change is routed through absorbing fields and overflow ([rules-and-fields.md](rules-and-fields.md#absorbing-and-overflow)). How a multiplied incoming amount rounds is a game setting (`settings.roundIncoming`). The effect's `when`, `value` and `then` see the change as `incoming` (see below), and the receiving player's [situational choices](rules-and-fields.md#choices-on-incoming-changes) on the change as `situational`. A situational choice's own incoming-change effects apply only to a change that selects it.
- **Choice steps as actions run:** `target: { choices: [push-cost], from: self }`. The effect adds an option to every choice step of the character's actions that carries a matching tag; `from: self` limits it to the actions of the item carrying the effect, as for rolls. The only op is `option`.
- **Changes steps as actions run:** `target: { steps: [strike.hit], from: self }`. The effect adds changes to every `changes` step of the character's actions that carries a matching tag, after the step's own, each time it runs (per participant in an `each` step); `from: self` limits it to the actions of the item carrying the effect, as for rolls. The only op is `changes`, whose value is `{ changes?, to?, flags?, order? }` (one of `changes` and `flags` at least): `flags` are set as the step runs, before its own changes (per participant in an `each` step; only flags the action sets elsewhere, checked at load, as an added option's), and `changes` are proposed after the step's own, or with `order: before` before them, `to` the value's `to`, else the step's. Its `when`, flags and changes see what an added option's do, with the action's `participants` (and `participant` in an `each` step) and no `picks`. Content items, templates, content types (for each active item of the type) and the rules' effects add changes, as for options (a build error on a situational choice's or a choice's). See [engine-actions.md](engine-actions.md#other-steps).
- **Actions run at changes steps:** the same target with op `action` runs a rules action at the step, after the step's changes and those `changes` effects add, each time it runs while the effect's `when` holds: a rider that needs a roll, often the target's saving throw. The value is `{ id, use, params?, participants?, each?, as?, changes?, to? }`. `use` (a rules action, resolved in the effect's pack) runs as an `action` step would, with the running action's entry, source and situational choices; `params` and `participants` are evaluated in the effect's context. With `each: <role>` it runs once per participant of the role (none for a role the action doesn't declare), `when` evaluated per participant; in an `each` step it runs for the step's current participant, and an `each` naming another role is `unknown-role`. With `as: participant` the run is handed off to the current participant (`unknown-role` without one). The value's `changes` are then proposed as a `changes` effect's, `to` its `to`, else the step's (a role's to the current participant only), reading the run's outcome as `run` (`run.result`, `run.data`). Its ID is `<content id>#<id>`, as an added option's; of the effects reaching one step with one ID, only the first to run at a path (its `when` holding there) runs there, and the run's path is `<step path>/<that ID>` (`[<i>]` per participant), so each feature's save is its own checkpoint. Its formulas see what a `changes` effect's do. See [engine-actions.md](engine-actions.md#other-steps).

- **Actions as they are listed:** `target: { actions: [kw.psionic], from: self }`. The effect adds
  parameters to every listed action of the character whose tags (computed ones evaluated for the
  listing) match; `from: self` limits it to the actions listed for the copy carrying the effect.
  The only op is `params`, whose value declares them as an action's own `params` (name to
  declaration). While its `when` holds (evaluated as the action is listed and started: `item`
  and `self` the content carrying the effect, the listing's as `action.item` and `action.self`,
  and the character's fields), each is a parameter of the action after its own, checked by
  startAction like them (on the run the app starts only, never a nested one) and listed by
  describeAction with `addedBy`. Its `min` and `max` also see the action's `params`, checked
  once every parameter has its value. Each is `optional` or has a `default`; a name an action its
  literal tags reach declares, or another effect's other declaration of the name (not between
  `from: self` effects of different content items, unless one item holding both has an action
  both reach), is the load error
  `invalid-added-param` ([dice-and-actions.md](dice-and-actions.md#actions)), counting only
  actions and effects of packs that meet
  ([Which packs a tag target reaches](#which-packs-a-tag-target-reaches)). The action's own
  formulas only see the parameters it declares; content reads an added one as `params.<name>` in its roll, option and `changes`
  effects. Text: `<content key>.params.<name>.name` (and `.values.<value>.name`), the content
  key the item's, `types.<type>` for a content type's effect, `rules` for the rules'. Content
  items, templates, content types and the rules' effects add parameters, as for options. See
  [dice-and-actions.md](dice-and-actions.md#actions). Removing or retyping an added parameter
  is an interface change of a pack's release (`param-removed`, `param-type-changed`), and
  narrowing its effect's `when` or `target` needs a breaking bump too
  ([upgrades.md](upgrades.md#a-packs-interface)).

**Another item's fields.** An effect targets the character, never a content item's fields. To
change those (a cantrip's range, a weapon that counts as magical), content keeps a template on
the item: on the character's copies, or on content picked or granted to them, such as a spell
known ([content.md](content.md#kept-templates)).

**Options added to choice steps.** An `option` effect's `value` is `{ id, changes?, to?, flags? }`. While the effect's `when` holds, a matching choice step offers it after its own options, with the ID `<content id>#<id>` (`fitd-scoundrel:special-abilities.battleborn#special-armor`), named by `<content id>.options.<id>.name`. When it is picked, its `changes` are proposed like a `changes` step's, `to` the option's `to` (default `self`); an option without `changes` is only recorded as the step's pick, for later steps to read (Sculpt Spells' `spare`). Its `flags` are set as the action's flags first, before its `changes`; it may set only flags the action sets elsewhere, in a branch case or a written option, which is checked at load. In its `when`, `flags` and `changes`, `item` and `self` are the content carrying the effect (`entry: self` is that copy, and `pick: owner` and `grant: owner` its pick or holder grant, below) and the action's own item, copy and step are `action.item`, `action.self` and `action.step`; the action's `params`, `situational`, `steps` and `flags` are bound too, and `when` sees `picks`. Of the options sharing a `stackKey` on one step, only the first offered counts, whatever the stacking policy; content never makes its option the recommended one. Content items add options, and so do content types: a type's `option` effect acts for each active item of the type as if the item wrote it (`item` and `self` that item and its copy, the ID `<item id>#<id>`), and is named by `<item id>.options.<id>.name` if the item has that text, else by the type's `types.<type>.options.<id>.name`, so one option serves every staff, wand or scroll. The rules' `effects` add options too, so a pack reaches its dependencies' tagged steps (an add-on's extra option in the core's creation): the ID is `<pack>:rules#<id>`, named by `rules.options.<id>.name` in the pack, `item` and `self` are unbound (and so are `entry: self`, `pick: owner` and `grant: owner`), and `from: self` is a build error, the rules having no item. An `option` effect of a situational choice or a choice is a build error. See [engine-actions.md](engine-actions.md#choice-steps).

```yaml
# Battleborn: mark special armor instead of taking stress for a push.
- target: { choices: [push-cost] }
  op: option
  when: '!armor.special'
  stackKey: special-armor
  value:
    id: special-armor
    changes:
      - { type: set, field: armor.special, value: true }
```

**The adding content's own pick or grant.** In an added option's `changes` (and a `changes`
effect's), `pick: self` and `grant: self` still name the pick or grant of the action's content
(the spell being cast). `pick: owner` and `grant: owner` name those of the content carrying the
effect, when it is picked or holder-granted content that declares saved state; otherwise they
are `unknown-reference` when the change is resolved. A 5E invocation spends its own use on the
spell it casts:

```yaml
# content/invocations/mire-the-mind.yaml: cast slow once with a pact slot.
- target: { choices: [spell-cost] }
  op: option
  when: "action.item.id == '5e-srd-5.1:spells.slow' && !self.used"
  value:
    id: pact
    changes:
      - { type: setState, pick: owner, key: used, value: true }
```

**The incoming amount, and effects that change their own entry**. An
incoming-change effect's `when`, `value` and `then` see `incoming`: `incoming.amount` is the
change's `by` as requested, before any incoming-change effect (negative for harm), so every
effect sees the same number whatever op runs first; `incoming.field` is the qualified ID of the
field; `incoming.tags` is the change's tags. An incoming-change effect may also carry `then`: a
list of changes to its own **entry**, `self`: the copy for a `holder` effect, the applied entry
for an `applied` one (for content an applied grant reaches, the granting entry). Each is a
`setState` or `adjustState` with `entry: self`, or, on an `applied` effect only, a
`removeEffect` with `entry: self`, which ends the entry. A state change goes where `self` reads
the key: for picked content that declares it, the pick's own state (as `pick: self` does in an
action); for held granted content that declares it, the grant's saved state (as `grant: self`
does); any other key, the owning copy's. When the effect counted (its `when` held and stacking
kept it), applyChanges applies them right after the adjust is routed, and reports each in
`adjustments`: a state change as `{ key, value, source }` with the address a setState would
take (`entry`; `path` and `option`; or `grant` with either), a removal as
`{ entry, removed: true, source }` ([engine-core.md](engine-core.md#routing-an-adjust)). Their
`value` and `by` are formulas seeing `item`, `self` and `incoming`. They are not adjusts, so
nothing routes or triggers on them. Instead of `entry: self`, a state change may name
`pick: owner`, the pick that activated the effect's content, or `grant: owner`, the holder grant
that did, whatever keys they declare; content that isn't picked or granted that way has none,
`unknown-reference`. Only an effect with an entry can carry `then`: on the rules'
`effects`, a situational choice's or a choice's `effects` it is a load error,
`then-without-copy`. Mothership armor points ignore damage under the armor's AP; damage at or over it breaks the
armor, and only the excess gets through:

```yaml
# mothership-1e, contentTypes.armor.effects
- id: armor-points-hold
  target: { incoming: { fields: [health.current], tags: [damage] } }
  op: multiply
  value: 0
  when: >-
    self.equipped && !self.destroyed && item.ap > 0
      && !('damage.anti-armor' in incoming.tags) && -incoming.amount < item.ap
- id: armor-points-break
  target: { incoming: { fields: [health.current], tags: [damage] } }
  op: add
  value: item.ap
  when: >-
    self.equipped && !self.destroyed && item.ap > 0
      && !('damage.anti-armor' in incoming.tags) && -incoming.amount >= item.ap
  then:
    - { type: setState, entry: self, key: destroyed, value: true }
```

A damage threshold alone (damage under it is ignored, otherwise all of it gets through) is the
first effect without the second.

An applied effect that lasts until it does its job removes its entry. 5E's Death Ward leaves
its target at 1 Hit Point the first time it would drop to 0, and ends:

```yaml
# Death Ward, applied to its target
- id: ward
  target: { incoming: { fields: [hp.current], tags: [damage] } }
  op: atLeast
  value: 1 - hp.current
  when: hp.current + incoming.amount <= 0
  scope: applied
  then:
    - { type: removeEffect, entry: self }
```

Once an entry is removed, the rest of the `then` changes aimed at it on that adjust, its own
effect's and its other effects', are skipped.

**Roll effects that end themselves**. A roll effect may carry `then` too, with the same changes
and targets (`entry: self`, `pick: owner`, `grant: owner`; `removeEffect` on an `applied`
effect). applyChanges never sees a roll, so the action proposes them: after a roll step, each
effect that **changed the roll** proposes its `then` changes, `to: self`, as changes of
that step, in effect order, resolved as a proposed change is (`entry: self` becomes the copy's
or applied entry's ID, or the pick's `path` and `option`, or the grant's address, as applyChanges
would route it; `removeEffect` its `id`), with `value` and `by` evaluated in the effect's roll
context. An effect changed the roll when its `when` held, stacking kept it, and it made a
difference:

- an `add` counted (on a tally, a non-zero amount); a `set` was the part's chosen replacement;
  an `atLeast` or `atMost` changed the total (or the tally);
- `advantage` or `disadvantage` is of the kind that applies once sources combine, and the roll
  had dice for it: cancelled sources, and those `noAdvantage` or `noDisadvantage` removed,
  didn't count; `noAdvantage` and `noDisadvantage` count when they removed a source;
- `multiply` and `multiplyDice` with a factor other than 1, `poolDice` adding dice, `stepDie`
  moving a die, `setFaces` giving an item faces, and `reroll`, `minimumFace` and `explode`
  reaching a dice item.

An effect proposes its `then` **at most once per action run**: the first roll step it changed
proposes it, and a later roll in the run (a roll made more than once, a reroll step, a used
action's roll) that it changes too proposes nothing more, so a condition that ends after a roll
is removed once and a boon spends one use, however often the run rolls. An effect is one effect
of one source: its entry's (an applied entry, a copy) or its pick's. The rolling action needn't
know which effects end: 5E's Sapped gives disadvantage on the target's next attack roll:

```yaml
# Sapped, applied to its target
- target: { rolls: [attack] }
  op: rollModifier
  value: { kind: disadvantage }
  scope: applied
  then:
    - { type: removeEffect, entry: self }
```

**When `then` fires.** A roll effect's `then` may instead be a rule, `{ changes, when, once,
to }`, the list being its `changes`:

| Property | Meaning                                                                                                                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `when`   | `changed` (default): the effect changed the roll, as above. `applied`: the effect was in play on the roll, its target matched the roll (on a `parts` target, a part of it) and its `when` held, whether or not stacking kept it, an opposite kind cancelled it or it made a difference                                         |
| `once`   | `action` (default): at most once per action run, as above. `roll`: once per roll step run that fires it, each pass of a group its own, so a boon that helps each attack of a volley spends a use for each; dice rolled again within the step (advantage, rerolled dice, a whole roll made more than once) are one roll         |
| `to`     | Who the changes are for, as a `changes` step's `to`. Default `self`, with the changes above. To another character (a role, `target`, `{ link }`, `applied`), they are any proposed changes, resolved as a `changes` step's for that `to`, with `item` and `self` the content carrying the effect and the roll effect's context |

The 5E rule ends Sapped on the next attack roll even when advantage cancels its disadvantage:

```yaml
then:
  when: applied
  changes: [{ type: removeEffect, entry: self }]
```

**Effects that end on another character.** An action sees the characters it is used on only
as views ([engine-actions.md](engine-actions.md#starting-an-action)), never their effects, so
an effect on the target can't change the attacker's roll. The attacker's effect that reads the
target's view does, and its `then` goes `to` the target: 5E's Vexed gives advantage on the
attacker's next attack against the vexed creature, and ends there. A `then` with a `to` other
than `self` changes no entry of the effect's own, so it may sit on the rules' effects, a
situational choice's or a choice's (not `then-without-copy`):

```yaml
# rules: advantage against a target this character vexed, which ends that Vexed. The `where`
# is the target's to evaluate: action roots (`flags.me`, the attack's flag of the attacker's
# ID) are filled in when it is proposed, `self` is then the target's entry.
- target: { rolls: [attack] }
  op: rollModifier
  value: { kind: advantage }
  when: size(participants.target) > 0 && character.id in participants.target[0].mastery.vexedBy
  then:
    to: target
    when: applied
    changes:
      - type: removeEffect
        applied: { where: 'item.id == @combat-effects.vexed && self.appliedBy == flags.me' }
```

The rule form is for roll effects; an incoming-change effect's `then` is a list (a schema
error otherwise). A roll effect's `then` changes aren't held by a `hold` action step
([dice-and-actions.md](dice-and-actions.md#actions)): they record a roll that was made.

An effect that ends on something other than a roll it was in play on (5E's Sanctuary ends when
the warded creature attacks) is out of reach of `then`. An effect that lasts for a number of
triggers counts them in a state key: one effect spends a use while more than one is left, and a
second, for the last use, removes the entry.

**Dice on incoming changes**. An incoming-change `add` may be dice; `set`,
`multiply`, `atLeast` and `atMost` stay numbers. applyChanges rolls it when it routes the adjust,
with faces from the change's `faces` and then from the dice function, and writes the faces it
used into the batch it returns, so a replay never rolls
([engine-core.md](engine-core.md#dice-on-incoming-changes)). MÖRK BORG armor takes its die off
every hit, and never heals:

```yaml
# mork-borg-core, contentTypes.armor.effects
- id: armor-die
  target: { incoming: { fields: [hp.current], tags: [damage] } }
  op: add
  value: 'item.tier - self.damage >= 3 ? 1d6 : item.tier - self.damage == 2 ? 1d4 : 1d2'
  when: self.equipped && item.tier - self.damage > 0 && !('damage.direct' in incoming.tags)
- id: armor-floor
  target: { incoming: { fields: [hp.current], tags: [damage] } }
  op: atMost
  value: 0
  when: self.equipped && item.tier - self.damage > 0 && !('damage.direct' in incoming.tags)
```

**Tags on added roll items.** An `add` effect on rolls may carry `tags` for the roll item it adds, so the item's damage type is known: Flame Tongue adds `2d6` tagged `damage.fire`. Entries may be formulas (`{ formula: "'damage.' + roll.item.damageType" }`), each giving one tag or a list of tags. `tags` is only allowed on `add` effects that target rolls.

**Items that aren't multiplied.** A `multiplyDice` roll modifier (5E's critical hit) multiplies every dice item in the roll, including dice added by effects: Flame Tongue's `2d6` is doubled. A `multiply` roll modifier (orc-2e's critical hit) multiplies the value of every rolled item, dice and flat, including those effects add. An `add` effect on rolls with `multiplied: false` adds items, dice or flat, that both leave alone, so 5E's Savage Attacks rolls its extra die once on a critical hit, and orc-2e's deadly die is added after doubling:

```yaml
- target: { rolls: [damage.weapon] }
  op: add
  value: dieOf(roll.item.damage)
  tags: [{ formula: "'damage.' + roll.item.damageType" }]
  multiplied: false
  when: has(flags.critical) && flags.critical && roll.item.range == 'melee'
```

The roll item records `multiplied: false`. Like `tags`, `multiplied` is only allowed on `add` effects that target rolls, and not on a roll tally (a schema error). The default is `true`. A roll part may say `multiplied: false` too ([dice-and-actions.md](dice-and-actions.md#roll-modifiers)).

### Tag matching

A target tag matches the same tag and every tag below it: `damage` matches `damage` and `damage.fire`; `damage.fire` does not match `damage`. Roll targets match a roll if **any** listed tag matches **any** of the roll's tags; choice targets match a choice step the same way.

### Which packs a tag target reaches

Tags are never qualified, so two games loaded in one ruleset (the `@opencharacter/packs` bundle,
an app or validator loading every pack, a homebrew mixing games) may both declare `attack`. An
effect's tag targets therefore reach only what packs that **meet** its own wrote. Two packs meet
over a target tag when their scopes (each pack with its dependencies, transitively) share a pack
that declares that tag, or a tag below it.

- **Rolls, choice steps, changes steps and listed actions:** the effect reaches a roll step, a
  choice step, a changes step or an action's listing (`params`) when one of its target tags
  matches the step's or action's tags and the action's pack meets the effect's over that target
  tag. The effect's pack is the pack that wrote it (an item's, a content type's, the rules', a
  situational choice's; an override's for the effects it replaced). The action's pack is the pack
  that wrote the action, whatever pack its formulas run in: a rules action's own (a `use` names
  one), a content type's for the type's actions, even on another pack's item, and an item's own
  (its override's, for actions it replaced). A nested `action` step runs the action it names, by
  that action's pack.
- **A set of fields:** any `fields` query, whatever its `where` reads, matches only fields of
  packs whose scopes share a pack with the effect's. It names no target tag, so no shared pack
  needs to declare one.
- **What meets:** an add-on and its core, either way round: an add-on's option in the core's
  creation, and the core's Bless on an add-on's or the homebrew's own spell attack (the homebrew
  depends on every pinned pack, so its own actions are reached by every game it depends on, and
  its effects reach theirs). Two add-ons of one core meet over the core's tags, so a condition
  from one reaches a monster's attack from the other. Packs with no pack in common never meet,
  whatever tags they share, even when a character pins both or a homebrew depends on both: a
  homebrew item of one game's content type runs that type's action, which only that game (and
  the homebrew) reaches. A base pack two games share connects them only over the tags it
  declares, so a shared base that doesn't declare `attack` connects nothing over `attack`. A pack
  needs no opt-in for its dependents: depending on a pack takes up its tag vocabulary.
- **Load checks:** `invalid-added-param` ([dice-and-actions.md](dice-and-actions.md#actions))
  counts an action by the pack that wrote it. A name is `declared` when an action the effect
  reaches by its literal tags declares it. Two `params` effects `conflict` when their target
  tags meet (one is the other or below it) over packs that meet on that tag, or when one action
  may take both: its literal tags meet a target tag of each, over packs that meet on that tag;
  two `from: self` effects of different content items don't, unless one item names both (itself,
  its grants, its choices' items) and has an action, its own or its type's, both reach. So one
  game's `params` effect
  never clashes with an unrelated game's action or effect, even when a third pack depends on
  both, while two add-ons of one core clash whether or not an action carries the tag yet.
- **Not scoped:** incoming changes. A change carries tags, never a pack: the receiving sheet's
  incoming-change effects and situational choices match its tags whichever character or action
  sent it, the tags being ones the receiving ruleset declares (an undeclared one is
  `unknown-tag`, [rules-and-fields.md](rules-and-fields.md#tags)). Stacking needs no scope of its
  own: it groups effects already on one field or one roll. An app's `policy` rules match the
  steps of whatever action it runs.

## Operations

| Op                   | Targets               | Value                                                                                                                     |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `set`                | field, roll parts     | formula: replaces the field's own formula or input; on a roll's parts, replaces them (dice or a number)                   |
| `add`                | field, roll, incoming | formula. On a roll or an incoming change it may be dice: Bless is `op: add, value: 1d4`.                                  |
| `multiply`           | field, incoming       | formula (0.5 halves, 2 doubles); the result is rounded                                                                    |
| `atLeast` / `atMost` | field, roll, incoming | formula; on a roll, an integer bounding its total once rolled (below)                                                     |
| `grant`              | `set` field, fields   | a formula/literal (one member) or `{ query }` (every match)                                                               |
| `rollModifier`       | roll                  | a [roll modifier](../data/roll-modifiers.json): `advantage`, `disadvantage`, `noAdvantage`, `noDisadvantage`, `reroll`, … |
| `option`             | choice                | `{ id, changes?, to? }`: an option for a tagged choice step (above)                                                       |
| `changes`            | step                  | `{ changes, to? }`: changes for a tagged changes step (above)                                                             |
| `action`             | step                  | `{ id, use, params?, participants?, each?, as?, changes?, to? }`: an action run at a tagged changes step (above)          |

There is no separate `addDice` operation: adding dice to a roll is `add` with a dice value. Roll modifiers are described in [dice-and-actions.md](dice-and-actions.md#roll-modifiers).

### Fixed order

For each field, the engine computes:

1. the field's own value (formula, input or default) and its grants;
2. **set**: if several `set` effects are active, they compete (see below);
3. **add**: the sum of all counted adds;
4. **multiply**: each counted multiplier in turn, rounding after each;
5. **atLeast / atMost**: the highest `atLeast` raises the value, then the lowest `atMost` lowers it. **PROVISIONAL:** this ordering resolves conflicts between the two.

Multiplying after adding matches how games apply resistance (to the total). Incoming changes follow the same order on the change's amount.

Effects declared by a content type come before the item's own effects in instance order and in
the breakdown; stacking and competition treat them like any other effect
([content.md](content.md#content-type-effects-and-grants)).

### Rounding

`multiply` results on integer values round right after each multiplication, by the effect's `rounding`, else the field's, else the game's `settings.rounding` (default `floor`). This holds for field values and for incoming changes. Any other decimal an integer field ends up with (from a formula, or an `add` with a decimal value) rounds once, at the end, by the field's `rounding`, else the game's. Every implementation therefore gets the same answer.

Every decimal step (each `add` and `multiply` on a decimal value, a field's or a change's) is first kept to six places ([formulas.md](formulas.md#six-places)), and rounding to a whole number applies to that six-place value: a decimal field adding 0.2 to 0.1 holds 0.3, and an integer field of 50 multiplied by 0.14 and rounding up is 7, not 8 (as doubles, 50 × 0.14 is 7.000000000000001).

### Bounds on a roll's total

An effect on rolls without `tally` may use `atLeast` or `atMost`, with an integer
`value` in the same context as other roll effects. Once the roll is rolled, the highest counted
`atLeast` raises its total, then the lowest counted `atMost` lowers it, as for fields and tallies;
stacking applies per op. `steps.<id>.total` and the step's band read the bounded total; the roll's
items and faces are unchanged, and the step's result and log entry list in `bounds` each bound
that changed the total, `{ source, op, value }`
([engine-actions.md](engine-actions.md#rolling)). 5E's Indomitable Might:

```yaml
# 5e-srd-5.1, content/features/barbarian/indomitable-might.yaml
effects:
  - target: { rolls: [check.str] }
    op: atLeast
    value: abilities.str.score
```

### Replacing a roll's part

A roll's parts are the action's (`steps.<id>.parts`), and a part may carry `tags`. A `set`
effect on rolls names the parts it replaces by tag, `target: { rolls: [<roll tags>], parts:
[<part tags>] }`, so content changes how a shared action works out a value
rather than adding an item that offsets it:

```yaml
# orc-2e, the ranger's Flurry edge: the multiple attack penalty against the prey.
- target: { rolls: [attack], parts: [strike.map] }
  op: set
  value: -(flags.map - min(2, flags.prior) * 2)
  when: '…the target is the prey…'
# The investigator's attack stratagem: Intelligence instead of Strength or Dexterity.
- target: { rolls: [stratagem], parts: [strike.attribute] }
  op: set
  value: attacks.int.mod
```

- **What it reaches:** the items built from each part whose tags match (a tag matches itself
  and every tag below it), after the parts are built and before any other roll effect; never
  an item an effect adds. A part whose `when` failed has no items, so nothing replaces it.
- **Which one:** the counted `set` effects on a part stack by key, as other roll effects do;
  of those left, the roll takes the one `settings.competing.recommend` names (`highest`, the
  default, `lowest`, `first` or `last`, compared by value). Unlike a field's, it isn't
  reported as competing.
- **The new items:** the value (a formula, as an `add`'s: dice or a number) becomes the part's
  items, with the part's tags. Their source is the effect's, unless the value is a single
  field reference: then the field is the source and the item reads it as a `field` part does,
  carrying the field's keyed effects into the roll's stacking. So stupefied
  reaches a Strike with Intelligence, and clumsy no longer does. A part with `multiplied:
  false` keeps it.
- **The record:** the first new item lists the part's items as built before in `replaces`
  (unrolled roll items), so a breakdown shows "Intelligence +4 (instead of Dexterity +3)".

`set` on rolls needs `parts` (a schema error otherwise), and `parts` takes only `set`,
`advantage` and `disadvantage` with `of: roll` (the matching parts rolled again as a group,
[dice-and-actions.md](dice-and-actions.md#roll-modifiers)), `stepDie`
and `setFaces`, never a tally.

### Roll tallies

A **tally** is a named integer counter on a roll that isn't part of its total: FitD's effect
level and result level, a PbtA "+1 forward" on the outcome. The rules declare the tallies a pack
uses (`rollTallies: [effect, resultLevel]`, [rules-and-fields.md](rules-and-fields.md#roll-tallies)),
and an effect targets one with `target: { rolls: [action-roll], tally: effect }`.

- Ops: `add`, `atLeast` and `atMost`, with an integer `value` in the same context as other roll
  effects. `from` and tag matching work as for other roll targets, and stacking applies per
  tally.
- Content, situational choices and rules-level effects can all target tallies.
- A tally name no visible pack declares is the load error `unknown-tally`.
- The action reads the sums as `steps.<id>.tallies.<name>`, and result bands as
  `roll.tallies.<name>`. What a tally means is up to the action's formulas.
- A step that classifies an earlier roll again per participant (`of`, `each`) with tags of its
  own works the tallies out again from the roll's, with the effects matching its tags and
  `participant` bound, so an edge against one target reaches only that target's band
  ([dice-and-actions.md](dice-and-actions.md#steps)). The roll's own `atLeast` and `atMost`
  hold there too, after the step's adds. Aim an `add` at one of the two tags, never both: it
  would count twice.

### Bounds on a band set's value

`target: { rolls, band: value }` aims an `atLeast` or `atMost` (an integer `value`) at the value
of the band set the matching roll step classifies by, once the set's `value` is worked out and
before its bands read it as `roll.value`, and again whenever that roll is classified again
(`of`). It needs a set whose value is a number, and does nothing on any other (`pnpm validate`
warns about a matching roll step whose set has no `value`). Stacking applies per op, as for bounds on the total; the log entry lists
each bound that changed the value in `bandBounds`. A minimum tier, Draw Steel's Area of
Expertise:

```yaml
- target: { rolls: [test.crafting], band: value }
  op: atLeast
  value: 2
  when: "flags.difficulty in ['easy', 'medium']"
```

## Scope

An effect's `scope` says who it applies to:

- **`holder`** (the default): a character who has the content active, through features or inventory, a pick, or a grant.
- **`applied`**: a character the content is applied to, through the character's `applied` list (a spell cast on them, a condition), or a grant with `scope: applied` of content applied to them (unconscious including blinded; [content.md](content.md#when-content-is-active)).

Content in `applied` runs only its `applied` effects, and held content runs only its `holder` effects. An aura's entry runs only its aura's effects and immunities, which are all `applied` ([content.md](content.md#auras)). So a caster who knows Bless doesn't bless themselves, while the targets it's cast on get +1d4. A spell that also changes its caster uses effects of both scopes. There is no content-type-level default for `scope`.

## Competing options

When more than one `set` effect is active on the same field (Mage Armor and Unarmored Defense both setting AC), the engine **does not decide**. It reports the options and the rules' recommended pick in `computeSheet`'s `competing` output: `{ field, op, stackKey?, options: [{ id, value, source }], recommended, applied }`. The recommendation follows the field's `recommend` or `settings.competing.recommend` (`highest`, `lowest`, `first`, `last`).

Each entry is one **competing group**: the `set` effects on a field (`op: set`), or a `playerChooses` [stacking](#stacking) group (its `op` and `stackKey`). A field can have several groups, such as two AC formulas and a choice of morale bonus, and each is picked on its own. A key [spanning fields](#one-source-across-fields) is one group across all its fields: its entry lists them as `fields` (`field` is the first), and each option is a source, with its score as `value` and its value per field as `values`.

The app applies the recommendation automatically or asks the player, and passes the picks back through `computeSheet`'s `competing` input: a list of option IDs, such as `['5e-srd-5.1:features.unarmored-defense#0']`. Each group applies the first of its options that is listed, in instance order; a group with none listed uses its recommended option.

Picks reach only `computeSheet`. The other calls (`listOptions`, `applyChanges`, actions) use each group's recommended option.

## Stacking

An effect with a `stackKey` is grouped with other effects that have the same key, target and operation. Each group is combined by the game's policy for that key (`settings.stacking.keys`, else `settings.stacking.default`):

| Policy          | Result                                             |
| --------------- | -------------------------------------------------- |
| `addAll`        | everything counts (the default)                    |
| `highestOnly`   | only the highest value counts                      |
| `lowestOnly`    | only the lowest value counts                       |
| `playerChooses` | only one counts; reported as competing, like `set` |

The key `source` is reserved: it means "the content item this effect comes from". It is how 5E says two Blesses don't stack (`keys: { source: highestOnly }`). Any other key is a literal: orc-2e uses `item`, `status` and `circumstance`. Effects without a key always count.

Effects that don't count because of stacking still appear in `computeSheet`'s `effects` with `suppressed: true`.

### One source across fields

Some bonuses are one bonus written on several fields: a Draw Steel kit's melee damage bonus is
+2/+2/+2 for the Martial Artist and +0/+0/+4 for the Mountain, one per tier. Grouped per field,
a hero with both kits would take +2/+2/+4, which the rules forbid. A key declared as
**spanning fields** groups its effects of one op on every field, and keeps one **source** for
all of them:

```yaml
settings:
  stacking:
    keys:
      kit-melee: { policy: playerChooses, spansFields: true }
      kit-stamina: highestOnly
```

- `policy` is `highestOnly`, `lowestOnly` or `playerChooses`; the source kept counts on every
  field of the group, and every other source's effects are suppressed there.
- A source's **score** decides: `score: sum` (the default), its values on every field added up,
  or `score: { field: kit.melee3 }`, its value on that field: one of the fields the key's
  effects target (`invalid-stacking` at load otherwise). Dice count by average.
- `playerChooses` reports the group once in `competing`, one option per source, the highest
  score recommended. Its option ID is the source's first effect's, and picking it applies the
  source on every field.
- The group is per op, as stacking always is: a key whose effects both `add` and `multiply` is
  two groups, each decided and picked on its own.
- A source is an item where it was reached, so two copies of one item are two sources. The
  reserved key `source` never spans.

Spanning is for the character's fields only. **Incoming changes and rolls** apply a spanning
key's `policy` per field (or per roll), not across fields: their effects group by key on the
change or roll they reach, and `playerChooses` keeps the highest there, as for any key. A roll
that reads a field still carries only the source the field kept
([engine-core.md](engine-core.md#stacking)).

An effect on a [set of fields](#targets) stacks on each field it reaches, with that field's other effects, as if written on it. A roll that reads a field carries the field's keyed `add` effects into its own stacking, so a roll-time bonus competes with the field's bonus of the same key instead of adding on top of it ([engine-actions.md](engine-actions.md#building-the-roll)).

## Showing the work

For each field, `computeSheet` returns the `base` value and a `breakdown`: each effect that changed it, in application order, with its `source` ("AC 17 = 15 Mage Armor + 2 shield"). Roll effects show up as roll items instead ([dice-and-actions.md](dice-and-actions.md#roll-items)).

## Loops

A field whose value depends on itself through formulas or effects is a loop. Loops are rejected at load time where they can be detected (`circular-formula`). Some loops appear only when a specific character combines specific items. In that case `computeSheet` marks the looping fields with an `error` instead of a value, and everything else still calculates. An engine MUST NOT hang on a loop.
