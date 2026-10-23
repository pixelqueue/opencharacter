# Dice and actions

## Dice notation

Dice notation is the familiar VTT notation, written inside formulas:

| Notation   | Meaning                          |
| ---------- | -------------------------------- |
| `NdS`      | N dice with faces 1..S (`1d8`)   |
| `Nd%`      | percentile, same as d100         |
| `NdF`      | Fate dice (−1, 0, +1)            |
| `(expr)dS` | computed count (**PROVISIONAL**) |

The [die types](../data/die-types.json) and [dice modifiers](../data/dice-modifiers.json) are **fixed sets, versioned with the spec**. A game that needs a new modifier waits for a spec version that adds it. Apps need to know the set in order to display rolls ("kept the higher die").

| Modifier                           | Notation        | Example     |
| ---------------------------------- | --------------- | ----------- |
| `keepHighest` / `keepLowest`       | `khN` / `klN`   | `2d20kh1`   |
| `dropHighest` / `dropLowest`       | `dhN` / `dlN`   | `4d6dl1`    |
| `explode` / `explodeCompound`      | `!` / `!!`      | `1d6!`      |
| `reroll` / `rerollOnce`            | `rN` / `roN`    | `1d20r1`    |
| `countSuccesses` / `countFailures` | `cs>=N` / `cfN` | `5d6cs>=5`  |
| `minimum` / `maximum`              | `minN` / `maxN` | `1d20min10` |

How to read a result (bands, success tiers) is game data ([result bands](rules-and-fields.md#result-bands)), not engine logic.

## Roll items

**PROVISIONAL shape** ([`roll-item.schema.json`](../schemas/roll-item.schema.json)).

A roll is a list of **roll items**. Each item is structured data, not a display string, and has exactly one source. Pieces that add together are separate items. Apps build their own labels.

```json
{ "kind": "flat", "value": 3, "source": { "type": "field", "id": "5e-srd-5.1:abilities.str.mod" }, "tags": ["attack"] }
{ "kind": "dice", "count": 2, "sides": 20, "modifiers": [{ "type": "keepHighest", "count": 1 }],
  "faces": [{ "value": 7, "kept": false }, { "value": 15, "kept": true }], "value": 15,
  "source": { "type": "situational", "id": "5e-srd-5.1:advantage" } }
```

- `count` is the number of dice actually rolled. Advantage on 1d20 is `count: 2` with `keepHighest 1`.
- `faces` lists every die in order, including dropped, rerolled (`rerolled: true`) and exploded (`exploded: true`) dice.
- `multiplied: false` marks an item added by an effect, or from a roll part, with `multiplied: false`, which `multiplyDice` and `multiply` left alone.
- `factor` is the product of the `multiply` factors applied to the item, whose `value` is then the multiplied one.
- `source.type` is one of `field`, `item`, `entry`, `template`, `effect`, `situational`, `rules`, `step` or `app`.
- How a source got its value (proficiency is +2 because of level) is not part of the roll. An app that wants to explain it follows the field's breakdown.

## Actions

An **action** ([`action.schema.json`](../schemas/action.schema.json)) is a cascade of steps, such as attack roll → hit or miss → damage. Actions are declared on content types (every item of the type gets them), on items, or in the rules as shared actions that items `use` (optionally fixing `params`).

| Property       | Meaning                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `available`    | When the action is offered (`self.equipped`)                                                                                                                             |
| `listed`       | `false`: computeSheet doesn't list it, so only other actions (and `startAction`) run it (below)                                                                          |
| `params`       | Values the app supplies (a target's AC, which stat to test), declared like state; `min`/`max` are enforced as the action starts ([engine-actions.md](engine-actions.md)) |
| `participants` | Roles other characters fill (a target, a helper), each with `min`, `max` and declared `fields`                                                                           |
| `steps`        | The cascade                                                                                                                                                              |
| `results`      | The results its outcome can have: a list of IDs, or `{ bands: <set> }` for a band set's bands                                                                            |

Formulas in an action see `item`, `self`, `params.<name>`, `situational.<id>`, `participants.<role>`, `steps.<id>.*` and `flags.<name>`. Where `item` and `self` mean something else (a choice step's candidates, a formula a change passes on), the action's own are `action.item` and `action.self`, and the current step is `action.step` (`id`, `tags`).

**Text for an action**. Everything an action puts in front of the player has a
translation key built from the action's key root, `<actionKey>` (`actions.<id>` for a rules
action, `<contentId>.actions.<id>` for an action on an item; see [i18n.md](i18n.md)):

- a choice step's question: `<actionKey>.steps.<step id>.prompt` (or the step's `prompt`);
- a parameter's label: `<actionKey>.params.<name>.name` (or the parameter's `label`);
- a roll step's name: `<actionKey>.steps.<step id>.name` (or the step's `label`), optional;
- each declared result: `<actionKey>.results.<result>.name`, or `bands.<set>.<band>.name` for
  `results: { bands: <set> }`.

An outcome `result` the action doesn't declare is the error `undeclared-result`; the type checker
reports a literal one at build time. An action without `results` isn't checked, and its results
have no text (`pnpm validate` warns).

```yaml
- id: weapon-attack
  results: [hit, miss] # actions.weapon-attack.results.hit.name, ….miss.name
  params:
    targetAc: { type: integer, optional: true } # actions.weapon-attack.params.targetAc.name
  steps:
    - id: confirm
      kind: choice # actions.weapon-attack.steps.confirm.prompt
      options: [{ id: hit }, { id: miss }]
```

**Computed tags.** In an action, any `tags` list (on a roll step, a roll part, an action step, a roll effect's added item, or a proposed change) may contain `{ formula }` entries. These are evaluated when the step runs. A formula gives one tag (a string) or several (a list of strings), spread in the entry's place, in order; an empty list adds nothing. Each must be a declared tag (`unknown-tag` otherwise), anything else is `type-mismatch`, and a tag already in the list (from an earlier entry) isn't added again. One shared attack action can then tag a longsword's damage `damage.slashing` and a bow's `damage.piercing`:

```yaml
- id: damage
  kind: roll
  tags: [damage.weapon]
  parts:
    - dice: item.damage
      tags: [{ formula: "'damage.' + item.damageType" }]
```

A roll of a field passed as a parameter carries the field's tags, however many it has (orc-2e's `check`: `check`, `skill`, `skill.athletics`, `attr.str`):

```yaml
- id: roll
  kind: roll
  tags: [d20, { formula: params.check.tags }]
  parts:
    - dice: 1d20
    - field: params.check.id
```

**Typed damage.** A proposed `adjust` with `split: { roll: <step>, by: <tag> }` becomes one change per distinct tag under `by` among that roll's items:

- The engine evaluates the change's `by` formula once per group, with `part.total` (the group's sum) and `part.tag` bound.
- Items with no such tag form one more group, which carries only the change's own tags.
- Incoming-change effects on the target then apply per change, so resistance halves only the fire part and rounds per damage type.

```yaml
- id: deal
  kind: changes
  to: target
  changes:
    - type: adjust
      field: hp.current
      split: { roll: damage, by: damage }
      by: -max(0, part.total)
      tags: [damage]
```

**Changes for a linked character.** `to: { link: <slot> }` sends a step's changes to the
character filling one of the actor's link slots ([rules-and-fields.md](rules-and-fields.md#link-slots)).
They are that character's changes, so they name its fields and content by qualified ID; the
build checks them against the slot's `pack` when the repo has it. A conspicuous creation's +1
heat for the crew (FitD):

```yaml
- id: heat
  kind: changes
  when: self.conspicuous && has(links.crew)
  to: { link: crew }
  changes:
    - { type: adjust, field: 'fitd-crew:heat', by: 1 }
```

**Adding items.** A proposed `addItem` may give its `entry` as an object whose values are
formulas: `item` (a string naming a content ID; local IDs resolve in the action's pack),
`quantity` (an integer), `equipped` (a boolean) and `state` values. `id`, `templates` and
`choices` are literal (but for computed picks, below), and `id` may be left out for the engine to pick an unused one. Any
proposed change may also have a `when` condition. A rolled starting weapon:

```yaml
- id: gear
  kind: changes
  changes:
    - type: addItem
      entry:
        item: "'weapons.' + ['femur', 'staff', 'shortsword', 'knife'][steps.weapon.total - 1]"
        equipped: true
    - type: addItem
      when: steps.weapon.total == 7
      entry: { item: "'ammo.arrows'", quantity: abilities.presence + 10 }
```

The returned change is an ordinary `addItem`. A literal `item` is checked at build time; a
computed one when the action runs.

A later step finds the new copies through `steps.<id>.added`: the instance IDs a changes or
choice step's `addItem`s gave the actor's new copies, in order, the ones the engine picked
included. So an action can ask the new copy's own choices, set its state or pick in it, with no
naming scheme. A focus gained twice gets two copies; each run asks only its own:

```yaml
- id: focus
  kind: choice
  options: { content: { type: focus } }
  changes:
    - { type: addItem, entry: { item: picked.id } }
- id: picks
  kind: choice
  options: { pending: { entry: 'steps.focus.added[0]' } }
```

A pick's `option` in `choices` may be `{ formula }`, evaluated by the action (with
`x` under `forEach`) to a string or number; the tree's keys stay literal. applyChanges checks an
added copy's picks as it would a `choose` of each (`unknown-choice`, `invalid-option`). 5E's
`create-monster` adds one copy of a generic innate-spell item per spell the stat block lists:

```yaml
- type: addItem
  forEach: steps.monster.item.innateOncePerDay
  entry:
    item: "'monster-actions.innate-spell'"
    state: { perDay: 1 }
    choices: { spell: [{ option: { formula: x } }] }
```

**Computed fields and `forEach`**. A proposed `set` or `adjust` may name its
field with a formula, `field: { formula: <string> }`. It is evaluated when the change is
resolved and qualified against the action's pack, as a literal field is; it must name an input
field (`unknown-field`, `not-input-field`), or for a link a qualified ID. A `split` adjust's
field is written out. Any proposed change may also have `forEach: <list>`: it is proposed once
per element, in list order, with `x` bound to the element, as in the list functions; its `when`
is evaluated per element, and an empty list proposes nothing. FitD crew creation marks each of
a table's own crew type's starting upgrades (qualified field IDs) in one change:

```yaml
- id: start
  kind: changes
  changes:
    - { type: adjust, field: coin.current, by: 2 }
    - type: adjust
      forEach: 'has(steps.type) ? steps.type.item.startingUpgrades : []'
      field: { formula: x }
      by: 1
```

Fate's minor milestone switches two skills the player names as field parameters. Both values are
read before either change applies, so the swap is exact:

```yaml
changes:
  - { type: set, field: { formula: params.skillA.id }, value: params.skillB.value }
  - { type: set, field: { formula: params.skillB.id }, value: params.skillA.value }
```

The build can't check a computed field, as it can't check a computed `addItem` item. Each copy
of a `forEach` change counts toward `maxActionSteps`. `x` is not bound in the formulas a change
aimed at copies passes on (`copies.where`, per-copy `by` and `value`).

**A computed entry**. A proposed change's `entry` (other than an `addItem`'s
new copy) may be `{ formula }` giving an instance ID, evaluated when the change is resolved and
passed on as the ID: to a participant too, whose own applyChanges checks it. An app passes the
copy as a parameter. orc-2e's runic weapon puts its template on the ally's weapon:

```yaml
- type: applyTemplate
  entry: { formula: flags.copy } # params.copy: the weapon's instance ID on the ally's sheet
  template: "'templates.runic'"
```

**Picking in a choice.** A proposed `choose` or `unchoose` gives its `path` and
`option`. `path.entry` is an instance ID, `self`, `picked` or `{ formula }`, as for `entry`, and
is left out for a rules-level choice. `path.choice` is the path as a list of literal segments, or a formula
giving the list; `option` is a formula. An `unchoose` may leave `option` out to
remove every pick of the choice, so an action can replace a pick it can't read: 5E's
shapechangers change form with an `unchoose` of their `form` choice, then a `choose`. A
creation action for a table's own FitD playbooks could pick the playbook, then the special ability
inside the picked playbook:

```yaml
- id: playbook
  kind: choice
  options: { content: { type: playbook } }
  changes:
    - { type: choose, path: { choice: [playbook] }, option: picked.id }
- id: ability
  kind: choice
  options:
    content: { type: specialAbility, where: 'steps.playbook.item.tags[0] in item.tags' }
  changes:
    - type: choose
      path: { choice: "['playbook', steps.playbook.picked, 'special-ability']" }
      option: picked.id
```

**Changes to copies by query.** A proposed `setState`, `adjustState`, `setField`,
`setQuantity`, `adjustQuantity`, `equip` or `removeItem` may name its copies with `copies: { type, where }`
(and `limit`) instead of `entry`. The character receiving the change resolves the query when it
applies it, so a `to: target` change can reach the target's copies, which the action never
sees. In `where`, and in a `by` or `value` that reads them, `item` and `self` are each matching
copy's item and copy:

```yaml
# MÖRK BORG attack, on a crit: the target's worn armor drops a tier.
- id: sunder
  kind: changes
  to: target
  changes:
    - type: adjustState
      copies: { type: armor, where: self.equipped && self.damage < item.tier }
      limit: 1
      key: damage
      by: 1
```

**The action's values in a passed-on formula.** `where`, and a `by` or `value` passed on per
copy, may also read `steps`, `flags`, `params` and `action`. The
action replaces each such path with its value as a literal before passing the change on, and
`has()` of one with `true` or `false`; the returned change reads only `item`, `self`,
`character` and fields. A path to a map
(`steps.roll`) has no literal and is a type mismatch: read a member (`steps.roll.band`). These
names mean nothing in a change an app writes for applyChanges.

**Spending a copy's quantity.** `setQuantity` and `adjustQuantity` change a copy's `quantity`.
It never goes below 0, so an action that spends from a stack aims at copies with some left: if
none match, nothing is spent and nothing fails. A copy at 0 stays; a later `removeItem` by query
can remove it. Here `item` in `where` is the ammunition, so the bow is `action.item`:

```yaml
# MÖRK BORG attack with a bow or crossbow: every shot spends one, hit or miss.
- id: shoot
  kind: changes
  when: has(item.ammo)
  changes:
    - type: adjustQuantity
      copies: { type: ammo, where: 'item.kind == action.item.ammo && self.quantity > 0' }
      limit: 1
      by: -1
```

With a bow, the proposed change reads `where: item.kind == 'arrows' && self.quantity > 0`.

**Applying content**. A proposed `applyEffect` names its `source` with a string
formula, qualified against the action's pack as an `addItem`'s `item` is; `active` and each
`state` value are formulas too. It may leave out `id`: the character receiving the change picks
one (`<source local id, dots as hyphens>-<n>`), so an action can apply a condition to a target
whose file it never sees. A potion applies itself to the drinker; a monster's hit applies its
condition, saying who applied it:

```yaml
# 5E monster-attack: the condition a hit causes, unless the target saved.
- id: condition
  kind: changes
  each: target
  when: flags.landed && has(item.condition) && (!has(steps.saves) || steps.saves.result != 'success')
  to: target
  changes:
    - type: applyEffect
      source: item.condition
      state: { by: creature.type, magical: has(item.spell) && item.spell }
```

**Equipping and templates**. A proposed `equip` computes `equipped` (a boolean
formula), for the copy `entry` names or every copy `copies` matches; a proposed `applyTemplate`
or `removeTemplate` names its `template` with a string formula, qualified against the action's
pack as `source` is. `setExtension` stays the app's, as `setHomebrew` does: extension data lives
under a namespace a pack can't know. 5E's Oil of Sharpness coats a weapon:

```yaml
- id: weapon
  kind: choice
  options:
    copies: { type: weapon, where: "item.damageType in ['slashing', 'piercing']" }
  changes:
    - { type: applyTemplate, entry: picked, template: "'magic-items.sharpness-coating'" }
```

**The action's own pick**. In an action of picked content, a proposed
`setState` or `adjustState` with `pick: self` names the pick that activated it: the returned
change carries its `path` and `option`. `picks: { where, limit? }` names picks by query and is
passed on as `applied` is. Orc Ferocity marks its daily use:

```yaml
- { type: setState, pick: self, key: used, value: true }
```

**The action's own grant**. In an action of content a holder grant activates, a
proposed `setState` or `adjustState` with `grant: self` names that grant's saved state: the
returned change carries its node (`entry`, or a pick's `path` and `option`) and `grant`, the
granted item. Outside such an action it is `unknown-reference`. `grants: { where, limit? }`
names granted content by query and is passed on as `picks` is. An artifact's gift commits Effort:

```yaml
- { type: adjustState, grant: self, key: committed, by: 1 }
```

**The change's own content's pick or grant**. `pick: owner` and `grant: owner` name the
pick or holder grant of the content the change is written on. In an action's own steps (and a
follow-up's changes) that is the action's content, as `self`; in an option or `changes` that
content adds through an effect, it is the effect's content, whose state its `self` reads, while
`self` stays the action's ([effects.md](effects.md#targets)). An invocation
that adds a way to pay for a spell marks its own use, not the spell's pick.

**Changes to applied entries by query.** `removeEffect`, `toggleEffect`, `setState` and
`adjustState` may name applied entries with `applied: { where, limit? }` instead of `id` (or
`entry`). As for copies, the receiving character resolves it: its applied entries, in file
order, whose `where` holds with `item` the source's item and `self` the entry (`id` and its
state, with declared defaults). `where`, and a `by` or `value` that reads `self` or `item`, are
passed on with the action's values substituted. `setState` and `adjustState` may also name one
applied entry by its ID in `entry`.

```yaml
# 5E long rest: sight rot worsens by 1.
- type: adjustState
  applied: { where: "item.id == '5e-srd-5.1:conditions.sight-rot'" }
  key: penalty
  by: 1
```

### Participants

An action may involve other characters: a target, a helper. It declares
each **role** under `participants`, and the app passes each role's characters to `startAction`
as **views** (`{ id, values }`), taken from their own computed sheets, like a link slot's
([rules-and-fields.md](rules-and-fields.md#link-slots)). The engine still computes only the actor.

```yaml
# 5e-srd-5.1 rules/combat.yaml
- id: weapon-attack
  params:
    targetAc: { type: integer, optional: true } # for apps that pass no target
  participants:
    target:
      max: 1
      fields:
        combat.ac: { type: integer }
        conditions.prone: { type: boolean, default: false }
```

- A role name is an identifier, not `self`. `min` defaults to 0 and `max` to unbounded, so a
  role is optional unless `min` says otherwise. `fields` is declared as a link slot's
  (`{ type, values?, default? }` per field ID); a role without fields gets views of only `id`.
  An optional `pack` names the pack participants are expected to use, which only the build
  checks the fields against (else against the action's own pack). Text:
  `<actionKey>.participants.<role>.name` (optional).
- A change sent to a role (or `target`) may name a field, content or copy type of a pack the
  actor's ruleset doesn't load, qualified with that pack: it is passed on as
  written, as a change sent to a link is, and the participant's own `applyChanges` checks it.
  The FitD crew's incarceration roll gives the member going to prison a trauma this way
  (`field: 'fitd-scoundrel:trauma.current'`, `to: prisoner`).
- `participants.<role>` is the role's list of views in input order, `[]` when none were given.
  A view is `id` plus the declared fields, nested at the dots
  (`participants.target[0].combat.ac`); a field the view lacks reads its `default`, else is
  absent (`has()`). Roll effects and result bands see `participants` too, as `dyn`: the running
  action's roles, empty when it declares none. So the attacker's rules can read the target's
  conditions:

```yaml
effects:
  - target: { rolls: [attack.ranged, attack.spell.ranged] }
    op: rollModifier
    value: { kind: disadvantage }
    when: >-
      has(participants.target) && size(participants.target) > 0
        && participants.target[0].conditions.prone
```

**Per participant.** A `roll`, `choice`, `changes` or `action` step with `each: <role>` runs once
per participant of the role, in input order, with `participant` bound to the current view and `when`
evaluated for each. With none, it doesn't run. Its paths gain the index (`saves[1]`,
`saves[1]/check`). Its result is the list of per-participant results (null where `when` skipped
one); inside a later `each` step over the same role it is the current participant's result, and
inside the step itself the list of its earlier runs (absent in the first run), so a per-target
choice can count the picks before it. `outcome` steps don't take `each`.

A `branch` step with `each` sets its flags per participant: a later `each` step
over the role reads the current participant's as `flags.<name>`, and elsewhere a flag is the list
(null where none was set). So a spell works out each target's outcome once:

```yaml
- id: degree
  kind: branch
  each: target
  cases:
    - when: true
      flags:
        outcome: "has(steps.save) ? indexOf(['critical-success', 'success', 'failure', 'critical-failure'], steps.save.result) : 2"
- id: burn
  kind: changes
  each: target
  when: flags.outcome > 0
  to: target
  changes:
    - { type: adjust, field: hp.current, by: '-steps.damage.total * [0, 0.5, 1, 2][flags.outcome]' }
```

**Handoffs.** An `action` step with `each` and `as: participant` runs on the participant's own
character instead: the action pauses with a `handoff` need naming the participant and the used
action with its evaluated `params`. The app runs that action on the participant's character,
with its own packs, situational choices, policy and dice, and answers `continueAction` with the
outcome. The step's result is `steps.<id>.result` and `.data`. A handoff always pauses, whatever
the policy. A handoff can pass participants on, the running character included:
Fate's attack hands the target `defend` with itself as the `attacker`, so a Riposte can hit back
(`participants: { attacker: '[character.id]' }`). Fireball, damage rolled once and saved per
target:

```yaml
- id: saves
  kind: action
  each: target
  when: has(item.save)
  as: participant
  use: saving-throw
  params: { ability: item.save, dc: flags.dc }
- id: burn
  kind: changes
  each: target
  when: has(steps.damage) && has(steps.saves)
  to: target
  changes:
    - type: adjust
      field: hp.current
      split: { roll: damage, by: damage }
      by: >-
        steps.saves.result == 'success' ? -floor(max(0, part.total) / 2) : -max(0, part.total)
      tags: [damage]
```

**Changes for a participant.** `to: <role>` (or `to: target`, which needs no declaration) sends
a step's changes to the role's characters. Each proposed change names its participant in
`character`: in an `each` step over the role, the current one; elsewhere, one copy per
participant, in order. With no participants, a change is proposed once without `character`, as
before. The changes name the actor's own fields, as `to: target` changes do.

### Steps

| Kind       | Does                                                                                                                                                                                                              | Result                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `roll`     | Rolls `parts` (one roll item each); roll effects matching the step's `tags` add items, modify dice or bound the total; an optional `bands` set classifies it; with `of`, classifies an earlier roll again (below) | `steps.<id>.total`, `.faces`, `.band`, `.rolls`                      |
| `choice`   | Offers `options` from one source (below); `recommend` or `prefer` names the rules' pick; `repeat` picks more than once                                                                                            | `steps.<id>.picked`, `.item`, `.self`, `.value`, `.values`, `.added` |
| `allocate` | Spends a budget across fields, or hands out a list of values, one per field ([below](#allocate-steps))                                                                                                            | `steps.<id>.amounts`                                                 |
| `branch`   | Runs the first case whose `when` is true (else `else`), sets its `flags` and runs its `steps`                                                                                                                     | `flags.<name>`                                                       |
| `group`    | Runs its `steps` once per pass, again while `repeat.while` holds, up to `repeat.max` passes ([below](#repeating-steps))                                                                                           | `steps.<id>[<n>].<step id>`                                          |
| `changes`  | Proposes changes for the app to apply, `to: self` (default), `to: target`, `to: <role>` or `to: { link: <slot> }`; `release` proposes held ones; content adds to a tagged one (below)                             | `steps.<id>.added`                                                   |
| `action`   | Runs another action (`use`, `params`, and `source`, `participants` and `tags` below), e.g. a panic check after a failed save; with `as: participant`, hands it off                                                | `steps.<id>.result`, `.data`                                         |
| `outcome`  | Ends the action with `result` and `data`                                                                                                                                                                          | —                                                                    |

Every step may have `when`; a step whose `when` is false is skipped. Roll, choice, changes,
action and branch steps may have `each: <role>` ([Participants](#participants)).

**Classifying a roll again**. A roll step with `of: <step path>` instead of
`parts` rolls nothing: it takes an earlier roll of the action (its path as the log names it,
relative to the action, so `check/roll` is the roll of the nested action step `check`) and
classifies it by its own `bands`, in its own context. With `each`, it does so once per
participant, with `participant` bound and that participant's flags, so one roll is compared with
each creature's DC, its tallies included. Its result is the earlier roll's (`total`, `kept`,
`tallies`, …) with its own `band`. orc-2e's Hide rolls Stealth once against every
observer:

```yaml
- { id: check, kind: action, use: check, params: { check: "'skills.stealth.mod'" } }
- id: dcs
  kind: branch
  each: observer
  cases:
    - when: true
      flags: { dc: participant.perception.dc } # the `degree` set reads `flags.dc`
- { id: against, kind: roll, each: observer, of: check/roll, bands: degree }
```

**Changes content adds**. A `changes` step may carry `tags` (computed entries
allowed, and those an `action` step adds count), and may have only tags: a place in a shared
action that content adds to. A content item's or template's `changes` effect aimed at a matching
tag proposes its changes after the step's own whenever the step runs (per participant in an
`each` step), while its `when` holds: a rune's persistent damage on a Strike's critical hit, a
feat's condition on a spell's targets, a toggle the start of a turn ends.

```yaml
# packs/orc/2e/rules/strikes.yaml, the Strike: a hit, and a critical hit.
- id: onHit
  kind: changes
  when: has(flags.hit) && flags.hit
  to: target
  tags: [strike.hit, { formula: "flags.crit ? ['strike.hit.critical'] : []" }]
# content/runes/flaming.yaml: 1d10 persistent fire damage on a critical hit with this weapon.
effects:
  - target: { steps: [strike.hit.critical], from: self }
    op: changes
    value:
      changes:
        - type: applyEffect
          source: "'conditions.persistent-damage'"
          state: { damage: 1d10, damageType: "'fire'" }
```

**Offering a follow-up**. A proposed `offerFollowUp` names a follow-up of the
content whose option or added changes propose it (or of its content type), else of the content
defining the action, else of the rules, with `params` formulas the action evaluates. The action
resolves it to the qualified follow-up and the content's source and proposes it to the actor;
applying it stores the follow-up as an ephemeral offer ([rules-and-fields.md](rules-and-fields.md#follow-ups)).
What a field can't show is offered so: which spell a cast paid for.

```yaml
# content/features/sorcerer/blood-magic.yaml: blood magic after a gift spell cast from a slot.
followUps:
  - { id: blood-magic, action: blood-magic }
effects:
  - target: { steps: [spell.paid] }
    op: changes
    when: "action.item.id in sorcerer.gifts && (flags.mode == 'spontaneous' || flags.pooled)"
    value:
      changes: [{ type: offerFollowUp, followUp: blood-magic, params: { rank: flags.rank } }]
```

**Action steps**. An `action` step runs the used action with the same character,
entry and source, and with `params` evaluated in its own context. Seven optional properties
change that (with `as: participant`, only `participants`):

- **`source`**, a formula giving a content ID (qualified against the action's pack), runs `use`
  as `computeSheet` lists it for this character with that `source`: that content is `item` and
  the listing's `entry` is `self`, so a monster's granted bite runs its `monster-attack` as the
  app would. With `source`, `use` may also be the local ID of an action the content's type or the
  content itself defines. Nothing listed (the action not available included) is `unknown-action`.
- **`entry`**, a formula giving an instance ID (a choice step's
  `steps.weapon.picked`), runs `use` as `computeSheet` lists it with that `entry`, and with that
  `source` when the step gives one too: that copy is `self` and its item `item`, as if the app
  had started the copy's action. Without `source`, `use` may also be the local ID of an action
  the copy's item or its type defines (`<item>#<use>`), so a monster's Multiattack runs its
  gore's own `charge` with `use: charge`. No such listing (no such copy, the copy doesn't list
  the action, or its `available` is false) is `unknown-action`. A feat that is a Strike with a
  weapon the player picks picks the weapon, then runs that copy's Strike (below).

**Actions only other actions run.** An action with `listed: false` (on the action, or on a
`use` of a rules action) isn't in computeSheet's `actions`, so apps never show it, in a display
group or in "Other". An `action` step with `source` or `entry` still finds it, while its
`available` holds, and `startAction` still runs it. So content adds its own part to a shared
rules action: MÖRK BORG's getting better runs the class's own step, which only some classes
have.

```yaml
# rules: getting better runs the part a class adds, if any.
- id: class
  kind: choice
  options: { copies: { type: class, where: item.betterPart } }
  recommend: options[0]
- id: classPart
  kind: action
  when: has(steps.class)
  entry: steps.class.picked
  use: better-part # classes.gutterborn-scum#better-part
# content/classes/gutterborn-scum.yaml
fields: { betterPart: true }
actions:
  - id: better-part
    listed: false
    steps: [{ id: second, kind: choice, options: [{ id: cowards-jab }, { id: gob-lobber }] }]
```

- **`participants`** maps the used action's roles to formulas giving lists of participant IDs of
  this action, in any role, or of their views, mixed or not: each view is passed
  on by its `id`, so `target: participants.target` passes on every target, and
  `participants.target[0]` is as good as `participants.target[0].id`. A list of anything else is
  `type-mismatch`. The nested action reads each participant's view as the app passed
  it, with its own declared fields, and its roles' `min` and `max` apply. Without it, the nested
  action has no participants. A handoff may pass participants too, and may also
  name the running character by `character.id` (the file's `id`); `needs.run.participants`
  lists the IDs by role, and the app passes their views to the run, as it would to
  `startAction`.
- **`tags`** are added to the tags of every roll step and choice step of the used action, and of
  the actions it runs in turn. Roll effects, situational choices, added options and policy rules
  match them as the step's own, so a shared `test` rolled for an attack is tagged `attack` too.
- **`situational`** gives the used action, and the actions it runs in turn,
  values for situational choices (by ID, local to the action's pack or qualified), each a formula
  evaluated here, in place of the running action's, as if the app had selected them. Twin Feint's
  target is off-guard to its second Strike: `situational: { offGuardTarget: true }`. Not with
  `as: participant`.
- A **`params`** formula giving `null` leaves its parameter out: an optional one takes its default
  or stays absent, a required one is `missing-param`. A field parameter given a field
  parameter's view (`params.skillA`) takes its `id`, so an optional parameter passes on as it
  came.
- **`hold: true`** keeps what the used action proposes instead of proposing it:
  every change it (and the actions it runs) proposes is resolved as usual and held under the
  step, in order (with `each`, every run's). The nested action's own steps see its changes, as
  always; the parent's later steps, a `sheet: proposed` one included, don't until they are
  released. A later `changes` step's **`release`** proposes held changes:

  | Property  | Meaning                                                                                                                       |
  | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
  | `steps`   | `hold` action steps of this action (`unknown-reference`, kind `step`, at load otherwise), released in this order              |
  | `where`   | Which to release: a condition with `change` bound to each held change as the action returns it (`tags` `[]` when it has none) |
  | `combine` | `true` merges released `adjust` changes equal in everything but `by`, recipient included, into the first one, `by` summed     |

  Released changes are proposed before the step's own `changes` (a step needs one of the two),
  each keeping the `step` path it was proposed at; those `where` leaves stay held for a later
  release, and changes never released are dropped. A step with `release` doesn't take `each`.
  So a parent decides what its nested action's changes become: orc-2e's Exacting Strike
  drops the Strike's count of the attack on a failure, and Double Slice combines its two
  Strikes' damage for resistances and weaknesses:

  ```yaml
  # packs/orc/2e/content/feats/fighter/double-slice.yaml
  - id: strike1
    kind: action
    use: strike
    entry: steps.first.picked
    hold: true
    participants: { target: participants.target }
  - id: strike2
    kind: action
    use: strike
    entry: steps.second.picked
    hold: true
    params: { attack: 'min(3, turn.attacks + 1)' }
    participants: { target: participants.target }
  - id: deal
    kind: changes
    release: { steps: [strike1, strike2], combine: true }
  # content/feats/fighter/exacting-strike.yaml: the Strike tags its count `attack-count`
  - id: pass
    kind: changes
    release:
      steps: [strike]
      where: "steps.strike.result != 'failure' || !('attack-count' in change.tags)"
  ```

A Multiattack made of a creature's own attacks, each against a target of its own:

```yaml
- id: multiattack
  participants:
    target: { max: 3 }
  steps:
    - id: bite
      kind: action
      use: monster-attack
      source: "'monsters.adult-red-dragon.bite'"
      participants: { target: 'size(participants.target) > 0 ? [participants.target[0].id] : []' }
    - id: claw1
      kind: action
      use: monster-attack
      source: "'monsters.adult-red-dragon.claw'"
      participants:
        target: >-
          size(participants.target) > 0
            ? [participants.target[min(1, size(participants.target) - 1)].id] : []
    # …
```

orc-2e's Double Slice: two Strikes, one with each melee weapon, the
second at the first's multiple attack penalty:

```yaml
- id: double-slice
  participants: { target: { max: 1 } }
  steps:
    - id: first
      kind: choice
      options: { copies: { type: weapon, where: 'self.equipped && item.range == 0' } }
    - id: second
      kind: choice
      options:
        copies:
          type: weapon
          where: 'self.equipped && item.range == 0 && self.id != steps.first.picked'
    - id: strike1
      kind: action
      use: strike
      entry: steps.first.picked
      participants: { target: participants.target }
    - id: strike2
      kind: action
      use: strike
      entry: steps.second.picked
      tags: [double-slice]
      params: { attack: 'min(3, turn.attacks + 1)' }
      participants: { target: participants.target }
```

**Reading the proposed character**. An action never applies its changes, so a
step reads the character as given. A step with `sheet: proposed` reads it with every change the
action has proposed so far `to: self` applied, in order: its fields, `character`, `self` and
`item` (the action's own copy there), a choice step's candidates, an allocate step's fields and
a roll's parts and effects. It is computed afresh before the step, `when` included, and before
each pick of a choice step; nothing is kept between calls. Changes for a role, a target or a link
aren't applied, nor are follow-ups. A batch that fails is `proposed-changes-failed`, a pack bug.
5E's starting hit points count the Constitution the race just raised:

```yaml
- id: finish
  kind: changes
  sheet: proposed
  changes:
    - { type: set, field: hp.current, value: hp.max }
    - { type: finishCreation }
```

A roll **part** is exactly one of:

- `dice`: a dice formula;
- `value`: a flat formula;
- `field`: a formula that evaluates to a field ID. The item's value is that field's value and its source is that field (Strength or Dexterity for a finesse weapon).

A `value` that is a single field reference gets that field as its source. Otherwise the default source is the item, or the rules, the action belongs to.

### Repeating steps

A `group` step runs a sequence of steps again and again: one **pass** of its `steps`, then
another while `repeat.while` holds (evaluated after each pass), up to `repeat.max` passes (an
integer formula, evaluated once). Its `when` decides whether the first pass runs. Fate's
invoke-and-reroll: after the dice, pay to reroll, see the result, and maybe reroll again:

```yaml
- { id: roll, kind: roll, parts: [{ dice: 4dF }, { field: params.skill.id }] }
- id: reroll
  kind: group
  repeat: { while: "steps.invoke.picked != 'keep'", max: 5 }
  steps:
    - id: invoke
      kind: choice
      options: [{ id: keep }, { id: fate-point }, { id: free-invoke }]
      recommend: "'keep'"
    - id: again
      kind: roll
      when: "steps.invoke.picked != 'keep'"
      parts: [{ dice: 4dF }, { field: params.skill.id }]
- id: done
  kind: outcome
  data: { total: 'has(steps.again) ? steps.again.total : steps.roll.total' }
```

- **Inside a pass**, `steps.<step id>` is this pass's result, absent until the step runs in it
  (as a skipped step's is), and `steps.<group>` lists the passes before it.
- **After the group**, `steps.<group>` lists every pass, each a map of the results of the steps
  that ran in it by step ID (`steps.reroll[0].again.total`), and `steps.<step id>` is the step's
  latest result, whichever pass made it: `steps.again` is the last reroll, though the last pass
  kept it.
- **Paths.** A step in pass `n` is at `<group>[<n>]/<step id>` (`reroll[1]/again`): its
  checkpoints, log entries, proposed changes and the policy rules that name it. A roll step's
  `of` names a step of the group as `<step id>`: inside a pass, this pass's run; after the
  group, its latest.
- A group holds no other group, at any depth, nor takes `each` or `sheet`; each pass counts
  toward `maxActionSteps`, and more passes than `maxGroupPasses` is `safety-limit-exceeded`.

### Choice steps

A choice step's `options` come from one source:

- **A written list** `[{ id, when?, changes?, to?, flags? }]`: each option is named
  `<actionKey>.options.<id>.name`. An option's `changes` are proposed when it is picked,
  `to` its `to` (default `self`); its `flags` are set first.
- **Content**, `{ content: { type, where? } }`: the ruleset's content of a type, by qualified ID.
  Each option is a qualified content ID, named by the item's name.
- **The character's copies**, `{ copies: { type, where? } }`: inventory then features.
  Each option is an instance ID, named by the copy's item name.
- **Values**, `{ values, where? }`: plain values, strings or numbers, as a value choice's
  ([content.md](content.md#value-choices)). `values` is a list written out, or `{ formula }`
  giving a list, evaluated before each pick with the action's roots, so it can read `item`,
  `self` and earlier steps. Each value is offered once, in the list's order; its option ID is
  the value as a string. A formula that fails is an error, as any action formula is. Each value
  is named `<contentId>.options.<value>.name` when the action runs for content (its `item`) and
  the content's pack has it, else `<actionKey>.options.<value>.name` when the action's pack has
  it; otherwise the app names it (a content ID by its item's name, a field ID by the field's).
  So a shared action's values take per-content text: one `cast-spell` step with
  `{ values: { formula: item.castOptions } }` names Hex's `str` "Strength" and Bestow Curse's
  "Disadvantage with Strength" ([i18n.md](i18n.md#key-conventions)).
- **Pending choices**, `{ pending: { entry? } }` or `{ pending: { path } }`: the choices still pending on
  the [proposed character](#steps), in `pending`'s order (each item's own choices before
  those of what it grants, each followed by those of what it picked),
  one per pick, each with its eligible options as
  `listOptions` gives them, then `#done`. Each pick proposes the `choose`; the step goes on until
  nothing more can be picked, so an action asks what the content it adds brings without naming
  it. `entry` (an instance ID formula) asks only that copy's choices; `path` (a choice path, as a
  `choose`'s) only the choices at it or under it. The app names each pick with the choice's own
  text (`needs.choice`).

In a query source's `where`, `item` (and for copies `self`) is the candidate, `picks` is how
many times the step has already picked it, and the action's own item and copy are `action.item`
and `action.self`. A value source's `where` sees the candidate as `value`, and `picks`; `item`
and `self` stay the action's own. A written option's `when` sees `picks` too.

A modular weapon's damage type comes from the copy's list, and a skill from the character's:

```yaml
- id: type
  kind: choice # actions.modular.steps.type.prompt
  options: { values: { formula: '[item.damageType] + item.modularTypes' } }
  changes:
    - type: setState
      entry: self
      key: modular
      value: "picked.value == item.damageType ? '' : picked.value"
- id: skill
  kind: choice
  options: { values: { formula: skills.trained } } # named by each skill field's name
  recommend: options[0]
  changes: [{ type: set, field: witchwarper.memorySkill, value: picked.value }]
```

**Options that set flags**. A written option, or one content adds, may set the
action's flags when picked, as a branch case does. They are set before the option's changes, so
those changes and every later step read them; a flag already set is replaced. An added option may
set only flags its action sets elsewhere (load error otherwise), so the action gives each a
default in an early branch:

```yaml
# The action: a default in its first branch.
- id: start
  kind: branch
  cases:
    - when: true
      flags: { slot: params.slot, castAbility: "'class'" }
# A trait's option on the `spell-cost` step casts at 2nd level with Charisma, and marks the
# trait's own saved state.
- target: { choices: [spell-cost] }
  op: option
  when: "action.item.id == '5e-srd-5.1:spells.hellish-rebuke' && !self.hellishRebukeUsed"
  value:
    id: hellish-rebuke
    flags: { slot: 2, castAbility: "'cha'" }
    changes:
      - type: setState
        grants: { where: "item.id == '5e-srd-5.1:traits.infernal-legacy'" }
        key: hellishRebukeUsed
        value: true
```

| Property    | Meaning                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tags`      | The step's tags: content adds options to it, and policy rules match it, by tag                                                                    |
| `recommend` | A formula giving the recommended option ID; it may read `options`, the source's offered IDs, so a roll can pick one                               |
| `prefer`    | Content, copies or values: a number per candidate; without `recommend`, the highest is recommended; with neither, nothing is (0100)               |
| `random`    | A condition: while it holds, each pick's recommendation is drawn uniformly with a die as large as the options (0108)                              |
| `repeat`    | `{ max, min? }`: pick up to `max` times; after `min` picks the reserved `#done` is offered last and ends the step                                 |
| `changes`   | Proposed after every pick, `to: self`; `picked` is `{ id }` (plus `item`, and `self` for copies; `value` for values); `entry: picked` is the copy |

Over pending choices `recommend` also sees `choice` (`{ path, owner, id }`, the choice asked), and
without it the choice's own recommendation applies; `picked` is `{ id, path }`, and the result
is `steps.<id>.picked` and `.paths`, both lists. 5E's level-up asks what the new level brings,
a subclass at 3rd level, an Ability Score Improvement at 4th:

```yaml
- id: picks
  kind: choice
  options: { pending: {} }
```

A FitD crew advance spent on an ability asks only the abilities under the crew type the crew
picked in its rules-level `crew-type` choice, not every other choice still pending:

```yaml
- id: typeAbility
  kind: choice
  options:
    pending:
      path: { choice: "['crew-type', steps.type.picked, 'abilities']" }
```

**Options added by content**. On a step with `tags`, the character's content
adds options with `option` effects aimed at `{ choices: [<tag>] }` ([effects.md](effects.md#targets)),
offered after the source's options as `<content id>#<option id>` and named
`<content id>.options.<option id>.name`. They are never recommended, so an automatic run keeps
the rules' choice. A picked option's own `changes` are proposed before the step's. Pushing
yourself in FitD costs 2 stress, or Battleborn's special armor:

```yaml
# rules/rolls.yaml, action-roll
- id: pushCost
  kind: choice # actions.action-roll.steps.pushCost.prompt
  tags: [push-cost]
  when: "situational.bonusDie == 'push' || situational.pushEffect"
  options:
    - id: stress # actions.action-roll.options.stress.name
      changes:
        - type: adjust
          field: stress.current
          by: "(situational.bonusDie == 'push' ? 2 : 0) + (situational.pushEffect ? 2 : 0)"
  recommend: "'stress'"

# content/special-abilities/battleborn.yaml: special-abilities.battleborn.options.special-armor.name
effects:
  - target: { choices: [push-cost] }
    op: option
    when: '!armor.special'
    stackKey: special-armor
    value:
      id: special-armor
      changes:
        - { type: set, field: armor.special, value: true }
```

`steps.<id>.picked` is the option ID, or with `repeat` the list of picks (`#done` left out).
Over content or copies without `repeat`, `steps.<id>.item` is the picked item and, for copies,
`steps.<id>.self` the picked copy; over values, `steps.<id>.value` is the picked value (a
number stays a number), and with `repeat` `steps.<id>.values` the picked values in order. 5E's
Arcane Recovery sums the slot levels picked so far, one level per slot recovered:

```yaml
- id: slots
  kind: choice
  options:
    values: [1, 2, 3, 4, 5]
    where: sumList(steps.slots.values, x) + value <= ceil(level.wizard / 2)
  repeat: { max: 5, min: 1 }
```

A step with nothing to offer is skipped. 5E's long rest
regains spent hit dice up to half the total level, one die per pick, from the classes the player
chooses:

```yaml
- id: hitDice
  kind: choice # actions.long-rest.steps.hitDice.prompt
  options:
    copies: { type: class, where: self.hitDiceSpent > picks }
  repeat: { max: 'max(1, floor(level.total / 2))' }
  prefer: self.hitDiceSpent - picks # recommend the class with the most dice still spent
  changes:
    - { type: adjustState, entry: picked, key: hitDiceSpent, by: -1 }
```

**Random picks**. While a choice step's `random` holds, the engine draws each
pick's recommendation: one die with as many sides as the options the source offers, logged and
paused for like any die (`needs.draw.among` lists what its faces name). A guided and a random
creation start share one action this way, and an allocate step's `random` draws its amounts
([Allocate steps](#allocate-steps)). A creation action can pick from the ruleset's content and
read the pick later:

```yaml
- id: class
  kind: choice
  options: { content: { type: class } }
  random: params.random # a d12 among the twelve classes
- id: strength
  kind: roll
  parts: [{ dice: steps.class.item.strength }]
```

### Allocate steps

An `allocate` step hands amounts to several fields at once. Its `fields`
is a query over fields (`{ type: field, where? }`, each field seen as `item`: `id`, `type`,
`tags`); the step offers the ruleset's integer input fields that match, in field order. The
query also sees the action (`steps`, `params`, `flags`, …), with the action's own item and copy
as `action.item` and `action.self`. It works in one of two ways:

- **A budget** (`budget`, an integer formula): the amounts' total cost must be the budget
  (`spend: all`, the default) or at most the budget (`spend: upTo`). An amount may never take
  the field's input past its `max`; `limit`, a formula with `field` (`{ id, value }`, the
  computed value before the step) bound, may narrow that further. `cost` is what an
  amount costs, a formula with `field` and `amount` bound; without it, the amount itself. The
  step proposes one `adjust` per field with a non-zero amount.
- **Values** (`values`, a list of integer formulas): each value goes to a different field, and
  every value is used exactly once. The step proposes one `set` per field given a value.

`recommend` maps field IDs to integer formulas; it is used only when it is a valid answer.
`random` (a condition) recommends a random answer instead: each value, or each
unit of the budget, goes to a field drawn uniformly among those that can still take it, with a
die per draw ([engine-actions.md](engine-actions.md#allocate-steps)). Fate's random pyramid hands
its ten ratings to any ten skills, homebrew ones included:

```yaml
- id: pyramid
  kind: allocate
  fields: { type: field, where: "'skill' in item.tags" }
  values: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]
  random: params.random
```

Under
an automatic policy the engine takes it, and without one the step pauses: the app answers with
`amounts`, a map of field ID to amount (fields left out get nothing). An answer that doesn't
fit (a negative amount, a field not offered, an amount over its limit, a cost that breaks the
budget, values not each used once) is `answer-mismatch`. `steps.<id>.amounts` is the answer, by
qualified field ID. A step whose query matches no field is skipped.

FitD's four creation dots, none taking an action above 2 with the playbook's own dots (which
the proposed sheet shows), and 5E's point buy and standard array:

```yaml
- id: dots
  kind: allocate # actions.create-scoundrel.steps.dots.prompt
  sheet: proposed
  fields: { type: field, where: "'rating' in item.tags" }
  budget: 4
  limit: max(0, 2 - field.value)
- id: pointBuy
  kind: allocate
  sheet: proposed # shows the 8s an earlier step set
  fields: { type: field, where: "'ability-base' in item.tags" }
  budget: 27
  spend: upTo
  limit: 7 # 8 to 15, after setting each score to 8
  cost: '[0, 1, 2, 3, 4, 5, 7, 9][amount]'
- id: standardArray
  kind: allocate
  fields: { type: field, where: "'ability-base' in item.tags" }
  values: [15, 14, 13, 12, 10, 8]
```

### Roll modifiers

`rollModifier` effects ([data](../data/roll-modifiers.json)) change how a roll is made:

- **`advantage` / `disadvantage`:** roll one extra die for the roll's main dice item (its first dice part) and keep the better or worse ones. "Better" follows the step's `better`: `high` (the default) or `low` (roll-under games).

  With `of: roll`, the whole roll is made again instead, every dice item, and the better or worse total is kept: "roll twice and keep the worse" on a 2d6 check compares two 2d6 totals, where an extra die would roll 3d6 and keep two. On a roll of one die and flat items the two agree. The kept roll's faces are the roll's `faces` and `kept`, so a band reading a natural reads the kept roll; the step's result and log entry list every roll as `rolls` ([engine-actions.md](engine-actions.md#rolling)). Sources count and combine as any advantage and disadvantage do, below; when one counted source of the kind that applies says `of: roll`, every extra is a whole roll. Ashes Without Number's Weak Heart, on its Exert checks:

  ```yaml
  - target: { rolls: [skill.exert] }
    op: rollModifier
    value: { kind: disadvantage, of: roll }
  ```

- **`noAdvantage` / `noDisadvantage`**: once the advantage and disadvantage sources are counted, set the count of that kind to 0, before `settings.rollModifiers.advantage` combines them. The player's situational advantage is a source like any other, so it is removed too. 5E's Elusive: no attack roll against the rogue has advantage, and disadvantage still applies.
- **`reroll`** (`below`, `once`, `count`), **`minimumFace`** (`value`), **`explode`** (`at`).
  `reroll`'s optional `count` (an integer formula) rerolls at most that many of the
  initial dice matching `below`, lowest faces first (earliest first among equal faces); without
  it, every matching die. The rerolled dice keep their order: their new faces are requested die
  by die, as for any reroll. The roll item's `rerollOnce` modifier carries the `count`. 5E's
  Empowered Spell rerolls up to the Charisma modifier of the damage dice (minimum one):
  `{ kind: reroll, below: 'floor(maxOf(dieOf(roll.item.damage)) / 2)', once: true, count: max(1, abilities.cha.mod) }`.
- **`multiplyDice`** (`factor`) multiplies the dice count of every dice item in the roll, including items added by other effects. This is how a critical hit doubles all damage dice. Dice added by an effect with `multiplied: false` are left alone ([effects.md](effects.md#targets)): 5E's Savage Attacks and Brutal Critical roll their extra dice once.
- **`multiply`** (`factor`) multiplies the value of every item once the roll is rolled, dice and flat alike, including items added by other effects: a critical hit that doubles the damage, not the dice (orc-2e, MÖRK BORG). Each item's value (a dice item's rolled value, a flat item's value) is multiplied by every counted `multiply` factor in turn, an integer result rounded by the effect's `rounding`, else `settings.rounding`, as a `multiply` effect is. Faces are unchanged; the item records `factor` (the product). The total is the sum of the multiplied items; `atLeast` and `atMost` bound it afterwards, and a proposed change's `split` sums the multiplied items. Tallies aren't items and aren't multiplied. `multiply` modifiers stack by key, as other roll effects do.

  Both leave alone the items marked `multiplied: false`: those an `add` effect with `multiplied: false` adds, and those of a roll part that says `multiplied: false`. orc-2e's deadly die is added after doubling:

  ```yaml
  - target: { rolls: [damage.strike] }
    op: rollModifier
    value: { kind: multiply, factor: 2 }
    when: has(flags.crit) && flags.crit
  - target: { rolls: [damage.strike], from: self }
    op: add
    value: dieOf(item.deadly)
    multiplied: false
    when: has(flags.crit) && flags.crit && has(item.deadly)
  ```

- **`stepDie`** (`steps`, an integer formula) changes the size of the dice from
  the roll's own parts: each moves `steps` along d4, d6, d8, d10, d12 (negative for smaller),
  stopping at either end; a die of another size (a d20, a d3, Fate dice, `dNz`) is left alone,
  and so are the dice effects add. With a `parts` target ([effects.md](effects.md#replacing-a-rolls-part))
  only the matching parts' dice move. The counted modifiers that reach an item add their steps
  (they stack by key, compared by `steps`), before pool dice and advantage, so those dice are
  the new size. The item records `steppedFrom`, its sides before. orc-2e's Healing Hands:
  `{ kind: stepDie, steps: 1 }` on heal's rolls.
- **`setFaces`** (`faces`, a list of integer formulas) gives a dice item its first
  faces instead of rolling them: the roll's main dice item, or with a `parts` target the first
  dice item of a matching part, after every other modifier. Faces past the item's count are
  ignored; one not on the die is `invalid-face`. Extra dice (advantage, rerolls, explosions)
  are still rolled or asked for, and a paused roll asks only for the faces not given; a roll
  whose every initial face is given doesn't pause. Each given face is marked `set: true` and
  isn't in the log entry's `faces` (what was supplied). Of several counted `setFaces` on one
  item, the first in effect order applies. orc-2e's Devise a Stratagem: the stratagem's
  Strike uses the d20 rolled earlier, `{ kind: setFaces, faces: [self.roll] }`.

How opposing modifiers combine (5E's advantage and disadvantage cancelling) is a game setting; see [Advantage and disadvantage together](#advantage-and-disadvantage-together).

### Pool dice

A `rollModifier` of kind `poolDice` adds `count` dice to a dice part of the roll
(the part named by `part`, or the step's first dice part), before its keep/drop modifiers:

```yaml
- target: { rolls: [action-roll] }
  op: rollModifier
  value: { kind: poolDice, count: 1 }
  when: situational.push
```

- The added dice are the part's die type. In the roll item, each added face records its
  `source`; faces without one belong to the item's own source.
- **`ifEmpty`:** a dice part may name what to roll when it ends up with no dice after pool dice
  are added. FitD rolls `2d6kl1` for an empty pool: `{ dice: '(params.rating.value)d6kh1',
  ifEmpty: 2d6kl1 }`.
- The roll result's `empty` (`steps.<id>.empty`, `roll.empty` in bands) is true when `ifEmpty`
  was rolled. FitD uses it to rule out criticals.

### Advantage and disadvantage together

`settings.rollModifiers.advantage` says how opposing roll modifiers combine:

- **`cancel`** (the default; 5E, Mothership): advantage and disadvantage together cancel, and
  any number of sources of one kind give one extra die.
- **`net`:** the difference between the number of sources decides the direction and how many
  extra dice.
- **`stack`:** every source adds a die; both kinds together is an error in the pack.

Advantage keeps the better dice per the roll step's `better`. That doesn't change how sources
net out. With `of: roll`, the extras are whole rolls: under `net` or `stack`, two extras make
the roll three times and keep the best total. The action log records every source, including cancelled ones. A `noAdvantage` or
`noDisadvantage` modifier removes its kind before they combine (above): with `cancel`, advantage
and disadvantage plus `noAdvantage` is disadvantage.

### Field parameters

A parameter of type `id` with `of: field` lets the app pass a field. `where`
restricts which fields, as a query over each field's `id`, `type` and `tags`:

```yaml
params:
  stat: { type: id, of: field, where: "'stat' in item.tags" }
```

- The action reads the field's computed value as `params.stat.value`, its qualified ID as
  `params.stat.id`, its type as `params.stat.type` and its tags as `params.stat.tags` (`[]`
  if none; computed ones evaluated on the sheet): the same view its `where` sees
  as `item`. An action can branch
  on what kind of field it was given (`'rating.prowess' in params.rating.tags`) instead of a list
  of field IDs.
- The type checker knows the union of the allowed fields' types for `.value`; `.id` and `.type`
  are strings and `.tags` a list of strings.
- A field outside the set is `invalid-option` when the action starts.
- Roll parts' `field:` stays available for picking a field by formula.

A **content parameter** (`type: id, of: <content type>`) may have `where` too: a
condition with `item` the candidate item (its own fields, no templates), the character's
fields, and the action's own item and copy as `action.item` and `action.self`. The app passes
the item's ID, qualified or local to the action's pack; an ID that isn't an item of the type, or
whose item doesn't match, is `invalid-option` when the action starts. Formulas read
`params.<name>` as the qualified ID. 5E's Stillness of Mind names the condition to end:

```yaml
params:
  condition:
    type: id
    of: condition
    where: "item.id in ['5e-srd-5.1:conditions.charmed', '5e-srd-5.1:conditions.frightened']"
```

## Checkpoints and policy

Each `roll`, `choice` and `allocate` step is a **checkpoint**, except a roll step whose built roll has no dice items: it never pauses, and no policy applies to it. Following the app's **checkpoint policy** ([`action-run.schema.json#/$defs/policy`](../schemas/engine/action-run.schema.json)), the engine either continues by itself (built-in or app-supplied dice; the recommended option) or **pauses**:

```yaml
policy:
  dice: auto # default for roll checkpoints
  choices: auto # default for choice checkpoints
  allocations: auto # default for allocate checkpoints
  rules: # first match wins
    - { kind: roll, tags: [attack], then: pause } # "wait on attack dice so I can animate them"
    - { kind: choice, tags: [push-cost], then: pause } # "ask how every push is paid for"
```

- By default the engine rolls with its built-in random number generator.
- The app may swap the **dice function** (its own randomness, a server roller, a seeded roller for tests). The dice function is a language-level callback, not data.
- When the app supplies dice, it supplies **individual die faces**, never totals. The engine does all the dice math: keep, drop, explode, rerolls and critical hits. Extra dice that are needed (explosions, rerolls) cause another pause or another call to the dice function.

## Paused actions and logs

- A paused result (`status: paused`) says what it `needs` (dice with `count`/`sides`; a choice with `options` and `recommended`, `#done` ending a repeated choice; an allocation with its fields, budget or values; or a handoff with `participant` and `run`), at which `step`, and which `action` defines that step, and carries `state`. The state is plain JSON, so the app can continue minutes later, from another request, or on another machine, by passing it to `continueAction`. The shape of `state` is **PROVISIONAL** (engine-defined).
- Every action keeps a **log** of every die face, choice, allocation and handoff outcome, which step and `action` it belongs to, and who supplied it (`engine` or `app`). Each pick of a repeated choice step is its own entry, numbered by `index`; a handoff's entry names its `participant` and `outcome`. Replaying an action from its inputs and answers MUST give the same result: startAction's `answers` takes the answers, one per pause, as continueAction does.
- Reactions after a roll (Lucky, Inspiration, pushing a roll) are choice checkpoints.
- A finished action (`status: finished`) returns its `outcome`, `proposedChanges` (`{ to, character?, step, change }`, fully resolved, with the path of the `changes` step that proposed each) and `log`. The engine never applies changes itself: the app applies `to: self` changes with `applyChanges`, applies a change for a role or a link to the character named by `character`, and routes a `to: target` change without one to the right character.

## Safety limits

Packs are untrusted, so every implementation enforces the [safety limits](../data/safety-limits.json): `maxExplosions`, `maxRerolls`, `maxDicePerItem`, `maxFormulaDepth`, `maxFormulaLength`, `maxChoiceDepth`, `maxActionSteps`, `maxActionDepth`, `maxGroupPasses`, `maxExtendsDepth` and `maxOverflowChain`. Reaching one is the error `safety-limit-exceeded`. The values are **PROVISIONAL**.
