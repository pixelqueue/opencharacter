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
| `target`     | A field, a set of fields, rolls, incoming changes, or choice steps (see below)                                                    |
| `op`         | One of the [effect operations](../data/effect-operations.json)                                                                    |
| `value`      | A formula, a grant value, a roll modifier, or an option, depending on `op`                                                        |
| `when`       | Condition. `self` is the copy carrying the effect.                                                                                |
| `stackKey`   | See [Stacking](#stacking)                                                                                                         |
| `rounding`   | Overrides the game's rounding for this effect's `multiply`                                                                        |
| `tags`       | `add` on rolls only: tags for the roll item the effect adds (see below)                                                           |
| `multiplied` | `add` on rolls only: `false` keeps `multiplyDice` and `multiply` off the items the effect adds (see below)                        |
| `duration`   | Informational only: `{ amount, unit, concentration }`. Time tracking is the app's job; the engine never ends an effect by itself. |
| `then`       | Incoming changes only: changes to the effect's own entry or state after the adjust is routed (see below)                          |

## Targets

- **A character field**, given by field ID: `target: combat.ac`.
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

- **Rolls as they happen:** `target: { rolls: [attack, damage], from: self }`. The effect applies to any roll carrying one of the tags. `from: self` limits it to rolls made by the item carrying the effect (a +1 weapon); `from: any` (the default) covers every matching roll the character makes (Bless). Roll effects add items to the itemized roll or modify its dice, and `atLeast` and `atMost` bound its total once it is rolled (see below). With `tally: <name>`, the effect adds to one of the roll's tallies instead (see below). With `parts: [<tag>]`, it reaches the roll's own parts carrying a matching tag instead of the whole roll: a `set` replaces them, and a `stepDie` or `setFaces` roll modifier changes only their dice (see [Replacing a roll's part](#replacing-a-rolls-part)). Its formulas see `item` and `self` as the content carrying the effect, the roll as `roll` and the action's own item and copy as `action.item` and `action.self`, so Bracers of Archery test their own copy while a bow attacks.
- **Incoming changes:** `target: { incoming: { fields: [hp.current], tags: [damage.fire] } }`. The effect modifies the amount of an `adjust` change aimed at this character before it is applied, so apps don't apply resistances themselves. Both filters are optional; omitting both matches every incoming adjustment. After these effects, the change is routed through absorbing fields and overflow ([rules-and-fields.md](rules-and-fields.md#absorbing-and-overflow)). How a multiplied incoming amount rounds is a game setting (`settings.roundIncoming`). The effect's `when`, `value` and `then` see the change as `incoming` (see below), and the receiving player's [situational choices](rules-and-fields.md#choices-on-incoming-changes) on the change as `situational`. A situational choice's own incoming-change effects apply only to a change that selects it.
- **Choice steps as actions run:** `target: { choices: [push-cost], from: self }`. The effect adds an option to every choice step of the character's actions that carries a matching tag; `from: self` limits it to the actions of the item carrying the effect. The only op is `option`.
- **Changes steps as actions run:** `target: { steps: [strike.hit], from: self }`. The effect adds changes to every `changes` step of the character's actions that carries a matching tag, after the step's own, each time it runs (per participant in an `each` step); `from: self` limits it to the actions of the item carrying the effect. The only op is `changes`, whose value is `{ changes, to? }` (`to` defaults to the step's). Its `when` and changes see what an added option's do, with the action's `participants` (and `participant` in an `each` step) and no `picks`. Content items, templates and content types (for each active item of the type) add changes, as for options (a build error on the rules' effects or a situational choice's). See [engine-actions.md](engine-actions.md#other-steps).

**Another item's fields.** An effect targets the character, never a content item's fields. To
change those (a cantrip's range, a weapon that counts as magical), content keeps a template on
the item: on the character's copies, or on content picked or granted to them, such as a spell
known ([content.md](content.md#kept-templates)).

**Options added to choice steps.** An `option` effect's `value` is `{ id, changes?, to?, flags? }`. While the effect's `when` holds, a matching choice step offers it after its own options, with the ID `<content id>#<id>` (`fitd-scoundrel:special-abilities.battleborn#special-armor`), named by `<content id>.options.<id>.name`. When it is picked, its `changes` are proposed like a `changes` step's, `to` the option's `to` (default `self`); an option without `changes` is only recorded as the step's pick, for later steps to read (Sculpt Spells' `spare`). Its `flags` are set as the action's flags first, before its `changes`; it may set only flags the action sets elsewhere, in a branch case or a written option, which is checked at load. In its `when`, `flags` and `changes`, `item` and `self` are the content carrying the effect (`entry: self` is that copy, and `pick: owner` and `grant: owner` its pick or holder grant, below) and the action's own item, copy and step are `action.item`, `action.self` and `action.step`; the action's `params`, `situational`, `steps` and `flags` are bound too, and `when` sees `picks`. Of the options sharing a `stackKey` on one step, only the first offered counts, whatever the stacking policy; content never makes its option the recommended one. Content items add options, and so do content types: a type's `option` effect acts for each active item of the type as if the item wrote it (`item` and `self` that item and its copy, the ID `<item id>#<id>`), and is named by `<item id>.options.<id>.name` if the item has that text, else by the type's `types.<type>.options.<id>.name`, so one option serves every staff, wand or scroll. An `option` effect in the rules' `effects` or a situational choice's is a build error. See [engine-actions.md](engine-actions.md#choice-steps).

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
nothing routes or triggers on them. Only an effect with an entry can carry `then`: on the rules'
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
effect's and its other effects', are skipped. An effect that lasts for a number of triggers
counts them in a state key: one effect spends a use while more than one is left, and a second,
for the last use, removes the entry.

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

`set` on rolls needs `parts` (a schema error otherwise), and `parts` takes only `set`, `stepDie`
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

## Scope

An effect's `scope` says who it applies to:

- **`holder`** (the default): a character who has the content active, through features or inventory, a pick, or a grant.
- **`applied`**: a character the content is applied to, through the character's `applied` list (a spell cast on them, a condition), or a grant with `scope: applied` of content applied to them (unconscious including blinded; [content.md](content.md#when-content-is-active)).

Content in `applied` runs only its `applied` effects, and held content runs only its `holder` effects. So a caster who knows Bless doesn't bless themselves, while the targets it's cast on get +1d4. A spell that also changes its caster uses effects of both scopes. There is no content-type-level default for `scope`.

## Competing options

When more than one `set` effect is active on the same field (Mage Armor and Unarmored Defense both setting AC), the engine **does not decide**. It reports the options and the rules' recommended pick in `computeSheet`'s `competing` output: `{ field, op, stackKey?, options: [{ id, value, source }], recommended, applied }`. The recommendation follows the field's `recommend` or `settings.competing.recommend` (`highest`, `lowest`, `first`, `last`).

Each entry is one **competing group**: the `set` effects on a field (`op: set`), or a `playerChooses` [stacking](#stacking) group (its `op` and `stackKey`). A field can have several groups, such as two AC formulas and a choice of morale bonus, and each is picked on its own.

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

An effect on a [set of fields](#targets) stacks on each field it reaches, with that field's other effects, as if written on it. A roll that reads a field carries the field's keyed `add` effects into its own stacking, so a roll-time bonus competes with the field's bonus of the same key instead of adding on top of it ([engine-actions.md](engine-actions.md#building-the-roll)).

## Showing the work

For each field, `computeSheet` returns the `base` value and a `breakdown`: each effect that changed it, in application order, with its `source` ("AC 17 = 15 Mage Armor + 2 shield"). Roll effects show up as roll items instead ([dice-and-actions.md](dice-and-actions.md#roll-items)).

## Loops

A field whose value depends on itself through formulas or effects is a loop. Loops are rejected at load time where they can be detected (`circular-formula`). Some loops appear only when a specific character combines specific items. In that case `computeSheet` marks the looping fields with an `error` instead of a value, and everything else still calculates. An engine MUST NOT hang on a loop.
