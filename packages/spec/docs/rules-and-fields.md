# Rules and fields

The rules layer is a set of **rules documents** ([`rules.schema.json`](../schemas/rules.schema.json)) per pack, merged by the build. This chapter covers fields, settings, constraints, result bands and situational choices. Content types are covered in [content.md](content.md), shared actions in [dice-and-actions.md](dice-and-actions.md), and display hints in [display-hints.md](display-hints.md).

## Fields

A field ([`field.schema.json`](../schemas/field.schema.json)) is one value on the character, keyed by **field ID** (`abilities.str.score`). Field IDs are dot-separated identifier segments (`^[a-z][a-zA-Z0-9_]*`), never containing hyphens, because formulas refer to fields by bare name.

There are two kinds of field:

- **Input fields** (`input: true`) are base state that the player supplies, such as ability scores, current HP, stress or action dots. They are the only field values a character file saves. An input field has no `formula`; its value comes from the character file or from `default`. Effects still apply on top of input values.
- **Derived fields** have a `formula`, or are filled only by effects (a `set` field filled by grants). Derived values are never saved, so a character can never disagree with the rules.

The engine does not model how inputs were arrived at (point buy, rolled stats, "my GM said 18"). It sees only the values and checks them against the field's type and range.

### Types

`type` is one of the [value types](../data/value-types.json):

| Type      | Values                         | Extra properties                                                                  |
| --------- | ------------------------------ | --------------------------------------------------------------------------------- |
| `integer` | whole numbers                  | `min`, `max`                                                                      |
| `decimal` | numbers, to six places         | `min`, `max`                                                                      |
| `boolean` | true / false                   |                                                                                   |
| `string`  | data text (never translated)   |                                                                                   |
| `enum`    | one of `values`                | `values` (required)                                                               |
| `dice`    | a dice formula (`1d8`)         |                                                                                   |
| `id`      | one reference                  | `of` (required): a content type, `field`, `tag` or `string`; for `tag`, `members` |
| `set`     | an unordered set of references | `of` (required); for `tag`, `members` ([below](#which-tags-a-field-takes))        |

`set` fields hold proficiencies, character tags and granted actions. Members come from input values and from `grant` effects ([effects.md](effects.md)).

### Range and defaults

- `min` and `max` are formulas. An input value outside them is a runtime error (`out-of-range`). A derived value outside them is clamped by the engine and is not an error. **PROVISIONAL.**
- `default` (input fields) applies when the character file has no value.
- `rounding` overrides the game's rounding for `multiply` effects on this field.
- `recommend` overrides the game's recommendation policy when `set` effects compete for this field (see below).
- `tags` let queries and display groups find the field (`type: field, where: "'skill' in item.tags"`),
  and effects reach a set of fields by them ([effects.md](effects.md#targets)). An entry may be
  `{ formula }`: see [Tags from a formula](#tags-from-a-formula).
- `deprecated` marks a field that upgrade scripts are retiring.

### Tags from a formula

A field's `tags` may hold `{ formula }` entries, as an action's tags may
([dice-and-actions.md](dice-and-actions.md#actions)), for a field that belongs to a set because
of the character: a DC based on the attribute the character's class names.

- The formula is evaluated on the character's sheet, as the field's own formula is: it reads
  fields, `character`, `links` and the functions, not `item` or `self`. It gives a tag (a string)
  or a list of strings, spread in its place; an empty list adds nothing. Each must be a declared
  tag (`unknown-tag`); anything else is `type-mismatch`.
- The field's **tags on a sheet** are its written tags, then the computed ones, without repeats.
- A formula that fails, or gives an undeclared tag or a wrong type, makes the field fail with
  that error, as its own formula failing would: its tags decide which effects reach it. A tag
  formula that reads, directly or not, a value depending on its own field's tags is a loop
  (`circular-formula`).
- Where a field's tags are read against a character, its tags on the sheet count: an effect on
  a set of fields ([effects.md](effects.md#targets)), a field parameter's view and `where`
  ([dice-and-actions.md](dice-and-actions.md#field-parameters)) and an allocate step's `where`.
  Where they are read without one, a field has its written tags only: queries over fields,
  display groups, and the field functions' static filter (`f.tags`, [formulas.md](formulas.md)),
  which are fixed per ruleset.

```yaml
# packs/orc/2e/rules/defenses.yaml: the class DC is based on the class's key attribute,
# so clumsy reaches a Dexterity fighter's and enfeebled a Strength fighter's.
classDc.value:
  type: integer
  tags:
    - dc
    - class-dc
    - { formula: "class.keyAttribute == 'none' ? [] : ['attr.' + class.keyAttribute]" }
  formula: 10 + classDc.proficiency + …
```

### Limits on the final value

`min` and `max` check an input field's saved value. `limits: { min, max }`
checks the **final** value, after effects:

```yaml
ratings.skirmish: { type: integer, input: true, min: 0, max: 4, limits: { max: 4 } }
```

A final value outside its limits is the rules issue `out-of-limits` (field, limit, value,
bound). It is not clamped and not an error, so a scoundrel whose playbook dots take Skirmish to 5
is reported, not silently capped.

**Caps on some sources**. When a cap binds only some of the effects on a value
(5E increases stop at 20, while a Belt of Giant Strength sets 21 or more), split the value
into fields: an input that the capped effects target, with `limits` reading a cap field, and the
final value as a formula over the input, which the uncapped effects target and everything else
reads. Content that moves the cap targets the cap field:

```yaml
abilities.str.base: # the saved score plus every increase
  { type: integer, input: true, default: 10, min: 1, max: 30, limits: { max: abilities.str.max } }
abilities.str.max: { type: integer, formula: 20 } # Primal Champion: add 4
abilities.str.score: # what modifiers and prerequisites read; items act here
  { type: integer, formula: abilities.str.base, min: 1, max: 30 }
```

An increase that takes the base past the cap is `out-of-limits` on the base; an item's
`atLeast 21` on the score is not checked against it.

### Fields the player names

A field may take its name from a string field: `nameFrom: <field ID>`. A Lore of
a city the player grew up in has no field until someone declares it, so a pack declares a few
Lores of the player's choice, each named by a subject the player writes:

```yaml
# orc-2e, rules/lores.yaml
skills.lore.custom1.subject: { type: string, input: true, default: '' }
skills.lore.custom1.mod:
  type: integer
  tags: [check, skill, skill.lore.custom1, attr.int]
  formula: 'attributes.int.mod + (skills.lore.custom1.rank > 0 ? 2 * skills.lore.custom1.rank + level : 0)'
  nameFrom: skills.lore.custom1.subject
# i18n: fields.skills.lore.custom1.mod.name: '{name} Lore'
```

- `nameFrom` names a string field the pack sees (`unknown-reference` at load otherwise; the
  validator also requires `type: string`). It changes nothing calculated.
- computeSheet gives the field's `name`, the string field's value, when it is a non-empty
  string ([engine-core.md](engine-core.md)); the field's text (`fields.<id>.name`) formats it
  as `{name}`, the empty string when there is none ("Lore").

### Absorbing and overflow

Numeric input fields can declare how incoming `adjust` changes are routed ([`field.schema.json`](../schemas/field.schema.json)):

```yaml
hp.current: { type: integer, input: true, min: 0, max: hp.max, absorbedBy: [hp.temp] } # temporary HP first
stress.current:
  type: integer
  input: true
  min: 0
  max: stress.max
  overflow:
    - { at: max, inclusive: true, into: trauma.current, by: 1, reset: 0 } # FitD: the last stress box is trauma
heat.current:
  type: integer
  input: true
  min: 0
  max: heat.max
  overflow: # FitD: heat reaching 9 is a wanted level, and the excess rolls over
    - { at: max, inclusive: true, into: wanted.current, by: 1, reset: 0, carry: true }
```

An incoming `adjust` on a field is processed in this order:

1. **Incoming-change effects** (resistance) modify the amount, and multiplications round per `settings.roundIncoming`. Their formulas see the requested amount as `incoming.amount` ([effects.md](effects.md#targets)).
2. **`absorbedBy`:** a decrease drains these fields first, in order, down to their minimum.
3. **The field** takes what remains.
4. **`overflow`:** if the result passes the bound named by `at` (or reaches it, with `inclusive: true`), the engine adjusts `into` by `by` (default 1) and sets the field to `reset`. The adjust on `into` is routed the same way, so overflow can cascade, up to the `maxOverflowChain` safety limit. The excess is dropped unless the entry says `carry: true`: then the excess past the bound (the result less the bound: positive past `max`, negative past `min`; 0 when it only reached it) is routed into the field again from its reset value, as an adjust with no tags and no incoming-change effects, so it can overflow in turn (FitD heat 7 and 12 more is two wanted levels and 1 heat; Mothership damage past 0 health comes off the reset health). Each step of a cascade reads the values the earlier steps stored.
5. **Clamping:** without an overflow for that bound, the result is clamped to `min`/`max`.
6. **`then`:** each incoming-change effect from step 1 that counted applies its `then` to its own entry: its copy (Mothership armor that breaks) or its applied entry, which it may also remove (oil that burns away).

Clamping is not an error. applyChanges reports what each adjust actually did in its `adjustments` output (absorbed, overflowed, reset, clamped).

### Families

A pack declares **families**, named lists of keys, in any rules document, and
writes a block of fields once for all of them. Any mapping key in its rules documents that
holds `{<family>}` (a field, a display hint, a content type's item field, an allocate step's
recommendation) stands for one entry per value, in its place, and every string in the entry has
`{<family>}` replaced by the value, keys included. Two placeholders give every combination, the
first outermost. Families are expanded before the pack loads; nothing after sees the
placeholders.

```yaml
# packs/5e/srd-5.1/rules/abilities.yaml
families:
  ability: [str, dex, con, int, wis, cha]
fields:
  'abilities.{ability}.score':
    { type: integer, formula: 'abilities.{ability}.base', min: 1, max: 30, tags: [ability] }
  'abilities.{ability}.mod':
    { type: integer, formula: 'floor((abilities.{ability}.score - 10) / 2)', tags: [ability-mod] }
```

- **Open families.** A pack that depends on another may add values to its family, named
  qualified: `families: { '5e-srd-5.1:caster': [artificer] }`, and declares the fields the
  family's patterns name for them in its own rules (`spellcasting.artificer.dc`). When both
  load, `keysOf` lists the added values and `fieldOf` reads an added value's fields from the
  pack that added it, so a content pack's class casts through the core pack's `cast-spell`
  without editing it. Family keys expand over the declared values only. A pack sees its own
  families and its dependencies' by name, its own first.
- **Reading by key.** `fieldOf('<pattern>', key)` reads the field a family pattern names for a key
  (`fieldOf('spellcasting.{caster}.dc', flags.cls)`); a pattern with two placeholders takes two
  keys, in order (`fieldOf('slots.{caster}.rank{rank}', flags.cls, 3)`). `keysOf('<family>')` lists
  the family's values (ints for a family of whole numbers): see
  [formulas.md](formulas.md#functions). A formula reads every field of the pattern, for the
  calculation order.
- **Shared view fields.** `viewFields: { <name>: { <field>: decl } }` names a set of declared
  fields; a link slot's or a participant role's `fields` may be that name instead of the map
  (5E's attack actions share `target`).
- **Errors:** a placeholder naming no family, a view-field name naming no set, an addition to a
  family that doesn't exist, a key that comes out twice, a family or set declared twice:
  `invalid-family` (data: `pack`, `message`).
- **Text** is per expanded field (`fields.abilities.str.mod.name`); i18n has no families.
- The build expands a pack's families, so a release has no family keys and no `viewFields`; it
  keeps `families` for `fieldOf`, `keysOf` and additions. An engine given an unexpanded pack
  (inline, homebrew) expands it before merging ([engine-core.md](engine-core.md#loadruleset)).

## Tags

The rules declare every tag the pack uses, in `tags`. That covers tags on content and fields, roll and change tags, effect targets, and members of `tag` sets such as proficiencies:

```yaml
tags:
  [
    d20-test,
    attack.melee,
    attack.ranged,
    damage.weapon,
    damage.fire,
    damage.slashing,
    armor,
    finesse,
  ]
```

- Declaring `damage.fire` also declares `damage`.
- A pack may use its dependencies' tags.
- The build rejects undeclared static tags (`unknown-tag`). A tag computed by a formula is checked when the action runs.
- Tags are data, not text. Apps may show labels from the optional translation key `tags.<tag>.name`.

### Which tags a field takes

An `id` or `set` of `tag` takes any declared tag. `members` narrows it, on a
field, an item field, a state key or an action parameter:

```yaml
damage.resistances:
  type: set
  of: tag
  input: true
  default: []
  members:
    under: [damage] # the tags below `damage`, not `damage` itself
    tags: [nonmagical, spell] # these tags themselves
    except: [damage.weapon, damage.spell] # never these (the tags below them still can be)
```

- A tag is a member when it is in `tags` or below a tag in `under`, and isn't in `except`. A
  tag in `under` is not a member itself: list it in `tags` too to take it. `except` drops a tag
  only, not the tags below it, so `under: [skill], except: [skill.lore]` takes every Lore but
  not `skill.lore`. `members` needs `under` or `tags`.
- Every tag `members` names must be declared by the pack or a dependency (`unknown-tag`).
- **Apps:** `loadRuleset` gives the declaration `tagOptions`, every tag the ruleset declares
  (with the tags above each) that it takes, sorted: what an "Add" picker offers.
- **Enforced** where a value comes in: applyChanges' `set` rejects a member outside it, and
  startAction a parameter outside it, with `invalid-option` (data: `field` or `param`,
  `option`). The build (`pnpm validate`) checks pack values: field and item field defaults,
  item fields, static `{ tag }` grants and saved character values. A tag a formula grants and a
  saved value are not checked by computeSheet: no rules issue.

## Settings

`settings` holds game-wide behavior ([`rules.schema.json#/$defs/settings`](../schemas/rules.schema.json)):

- **`rounding`**: how the game turns decimals into whole numbers, for `multiply` effects and division in integer contexts: `floor` (default; 5E's "round down"), `ceil`, `round` (half away from zero) or `truncate`.
- **`roundIncoming`**: how a multiplied incoming amount is rounded.
  - `value` (default) rounds the signed number.
  - `magnitude` rounds its size and keeps the sign. With `floor`, halving −11 damage gives −5: 5E rounds the damage down, not the number.
- **`stacking`**: `default` is the policy for stack keys that have no policy of their own (default `addAll`), and `keys` maps a stack key to its policy. Policies are `addAll`, `highestOnly`, `lowestOnly` and `playerChooses` ([data](../data/stacking-policies.json)). For example, 5E uses `keys: { source: highestOnly }` so that two Blesses don't stack.
- **`competing.recommend`**: which competing `set` effect the rules recommend: `highest`, `lowest`, `first` or `last`. Default `highest`. **PROVISIONAL.**

- **`rollModifiers.advantage`:** how advantage and disadvantage combine: `cancel` (default),
  `net` or `stack` ([dice-and-actions.md](dice-and-actions.md#advantage-and-disadvantage-together)).

## Constraints

`constraints` are game rules checked against the **current** character, never its history:

```yaml
constraints:
  - id: attunement-limit
    check: countCopies(has(copy.state.attuned) && copy.state.attuned) <= 3
    data: { limit: 3 }
```

A false `check` produces a rules issue with code `constraint-failed`, `id` set to the qualified constraint ID, and the evaluated `data`. Rules issues never block unless strict mode is on ([engine-interface.md](engine-interface.md)). Text: `constraints.<id>`.

A constraint that holds only while the character is being created guards on
`character.creating` ([Creation](#creation)); a finished character doesn't have to keep it:

```yaml
constraints:
  - id: creation-rating-limit # FitD: no action above 2 at creation
    check: '!character.creating || ratings.highest <= 2'
    data: { limit: 2 }
```

**A constraint per copy**. With `copies: { type, where? }`, the check runs once
for each of the character's copies of the content type (`features` and `inventory`, standard
copies included) whose `where` holds, with `item` and `self` that copy's item and copy, as a
choice step over copies sees them (its computed values included). Each failing copy is its own
`constraint-failed`, its instance ID in `data.entry` beside the constraint's `data`, evaluated
for it. So a sum over the copies stored in each container is a plain aggregate:

```yaml
# packs/orc/2e/rules/treasure.yaml
- id: container-capacity-held
  copies: { type: held, where: has(item.capacity) && item.capacity > 0 }
  check: >-
    sumCopies(copy.fields.bulk * copy.quantity, has(copy.fields.bulk)
      && has(copy.state.container) && copy.state.container == self.id) <= item.capacity
```

## Result bands

`resultBands` declares named sets of bands that classify a roll, such as Forged in the Dark's failure / partial / success / critical, or Powered by the Apocalypse's 6− / 7–9 / 10+. How to read a result is game data, not engine logic.

```yaml
resultBands:
  action:
    - { id: critical, when: 'flags.pool > 0 && count(roll.faces, 6) >= 2' }
    - { id: success, when: 'roll.total == 6' }
    - { id: partial, when: 'roll.total >= 4' }
    - { id: failure, when: true }
```

Bands are checked in order and the first true `when` wins. Formulas see the roll as `roll` (`roll.total`; `roll.faces`, every face rolled as an integer, dropped dice included; `roll.kept`, the kept faces; `roll.tallies`, the roll's [tallies](#roll-tallies)) and, PROVISIONALLY, the context of the action making the roll (`flags`, `params`, `steps`), so a roll-under band can compare against the tested stat. A roll step selects a band set with `bands: <set>`, and the band becomes `steps.<id>.band`. Text: `bands.<set>.<band>.name`.

**A set's value**. A band set may be written `{ value, bands }` instead of a list. `value` is a formula in the band context, evaluated once each time the set classifies a roll, before the bands; its bands read it as `roll.value`, typed as the formula's result (`roll.value` is bound only there: `unknown-name` elsewhere). A `value` that fails to evaluate fails the classification, as a failing `when` does. The roll step's result keeps it as `steps.<id>.bandValue`, and the action log's roll entry as `bandValue`. A result worked out once (a degree of success: the DC comparison, a natural 20 or 1, a cap) is then named by bands that compare one number, and a result a tally moves is moved in one place:

```yaml
resultBands:
  # Forged in the Dark: two sixes are a critical; otherwise 6, 4–5 or 1–3, moved by the
  # `resultLevel` tally and kept within failure and success.
  action:
    value: >-
      !roll.empty && count(roll.faces, 6) >= 2 ? 3
        : max(0, min(2, (roll.total == 6 ? 2 : roll.total >= 4 ? 1 : 0)
          + roll.tallies.resultLevel))
    bands:
      - { id: critical, when: roll.value == 3 }
      - { id: success, when: roll.value == 2 }
      - { id: partial, when: roll.value == 1 }
      - { id: failure, when: true }
```

## Roll tallies

`rollTallies` declares the names of the integer counters effects may add to on a roll without
changing its total ([effects.md](effects.md#roll-tallies)). Names are identifiers,
merged across a pack's rules documents (a name declared twice is an error), and a pack may use
its dependencies' tallies. A roll step exposes every visible tally as `steps.<id>.tallies.<name>`
(0 when nothing added to it), and result bands see `roll.tallies.<name>`. Text:
`tallies.<name>.name` (optional).

## Situational choices

`situational` ([`situational.schema.json`](../schemas/situational.schema.json)) declares choices made at roll time, such as advantage, cover, a GM's bonus, or pushing yourself, or when a change arrives, such as a reaction that halves one attack's damage. Declaring them lets apps offer them without knowing the game.

- `type` is `boolean`, `integer` or `enum` (with `values`), and `default` gives the starting value.
- `rolls` lists the roll tags the choice is offered for. Tags match by prefix ([effects.md](effects.md#tag-matching)).
- `incoming: { fields?, tags? }` offers the choice for incoming changes: an `adjust` whose field is one of `fields` and with a tag matching one of `tags`, each filter optional, as an incoming-change target matches ([effects.md](effects.md#targets)). A choice may have `rolls`, `incoming` or both. The receiving player selects it on the change itself (`situational` on an `adjust`, [below](#choices-on-incoming-changes)).
- `effects` apply while the choice is selected (boolean) or non-default (integer, enum). Formulas see the value as `situational.<id>`. Roll items added by these effects have source `{ type: situational, id }`.
- `available` is a condition on the character that says when the choice is offered: `omens.current > 0`, or a set field holding the content that grants the choice. Its formula sees the character's fields and `character`, as constraints do; there is no `item`, `self`, `steps` or `roll`, because it is decided before any roll. A choice without `available` is always offered. `computeSheet` lists the choices offered now in `situational`, and `startAction` rejects selecting one that isn't (`situational-unavailable`).
- Text: `situational.<id>.name`.

### Choices on incoming changes

5E's Uncanny Dodge halves the damage of one attack the rogue reacts to. The
choice is declared once and carried by the change it reacts to:

```yaml
situational:
  - id: uncannyDodge
    type: boolean
    default: false
    incoming: { fields: [hp.current], tags: [attack] }
    available: combat.uncannyDodge # set by Uncanny Dodge
    effects:
      - target: { incoming: { fields: [hp.current], tags: [damage] } }
        op: multiply
        value: 0.5
```

- An app shows the receiving player the offered choices (computeSheet's `situational`) whose
  `incoming` matches a change before applying it, and puts the ones selected on the change:
  `{ type: adjust, …, situational: { 5e-srd-5.1:uncannyDodge: true } }`.
- While that change is routed, each selected choice adds its incoming-change effects after the
  character's own, with source `{ type: situational, id }`. Every incoming-change effect, the
  character's own included, sees the values as `situational.<id>` (defaults for the rest).
- The choices reach only that change: not its overflow and not the rest of the batch.
- A selected choice that isn't offered, or whose `incoming` doesn't match the change, is
  `situational-unavailable` and rejects the batch ([engine-core.md](engine-core.md#routing-an-adjust)).
- An action never sets them: the target's player chooses, on the target's side. Spending the
  reaction is the app's.

## Link slots

`links` declares **link slots**: named places for another character whose values this pack's
formulas read, such as a scoundrel's crew. The other character is its own
character file, with its own packs, computed with its own `computeSheet`; the engine still
computes one character per call and never loads a second sheet.

```yaml
links:
  crew:
    pack: fitd-crew
    fields:
      tier: { type: integer, default: 0 }
      upgrades.mastery: { type: boolean, default: false }
```

- The slot ID is a name, qualified like a field ID (`fitd-scoundrel:crew`), and resolves
  in the pack, then its dependencies.
- `fields` declares what the pack reads, by field ID as the other character's packs name it,
  without the pack: a value type and an optional literal `default` (one shape for every place a
  pack reads another character). Formulas type-check against the declaration
  alone, so the other pack is never a dependency. `id` is reserved, and since a view nests fields
  at their dots, no declared ID may start another (`heat` and `heat.max`; the build reports it).
- A declared `set` says `of: string`: its value is a list of strings, read as
  the other character's sheet gives it (not qualified), so a crew can expose lists its members
  pick from or test against (`'fitd-scoundrel:ratings.sway' in
  links.crew.members.siteRatings`). A choice's `values` may read it
  ([content.md](content.md#choices)).
- `pack` is optional: the pack the linked character is expected to use. When it is loaded
  alongside, `loadRuleset` and the build check that each declared field is a field of it with the
  same type (`link-field-mismatch`). The engine never checks which packs the linked character
  uses: any character whose view has the declared fields may fill the slot.
- A character file saves which character fills each slot ([characters.md](characters.md)), and
  apps pass that character's **view** (`{ id, values }`) to the calls
  ([engine-core.md](engine-core.md#links)). Formulas read it as `links.<slot>`
  ([formulas.md](formulas.md#context-roots)).
- Changes for the linked character are proposed with `to: { link: <slot> }`
  ([dice-and-actions.md](dice-and-actions.md)).
- **An empty slot the rules want filled** is a derived follow-up with `create`:
  an offer naming the slot and the creation start that makes its character
  ([Follow-ups](#follow-ups)).
- **Point links one way**, from the sheet that depends to the sheet it depends on (scoundrel to
  crew). The engine never follows a link, so it can't loop, but if two sheets link each other
  the app computes them in some order and one sees the other's previous values. The build
  doesn't warn about it.
- Text: `links.<slot>.name` (optional).

## Follow-ups

`followUps` say what the rules call for on the character
([`follow-up.schema.json`](../schemas/follow-up.schema.json)): a level-up the experience has earned,
a concentration check after damage, a death save at maximum wounds, a companion's own sheet. The
engine never runs or applies one; the app runs it, or asks the player or GM first. There are two
kinds:

- **Derived offers** (`while`): a standing imbalance on the sheet. computeSheet offers one exactly
  as long as its condition holds, so a character set up by hand, imported or edited in another app
  sees the same offers. Nothing is stored, and a derived offer can't be dismissed; "not now" is
  the app's display choice.
- **Ephemeral offers** (`on`, `becomes`): a moment. The applyChanges that triggers one stores it
  in the character file (`followUps`), with what it fired on, until it is acted on (startAction
  with its ID proposes the clearing change) or dismissed (`dismissFollowUp`). A `becomes` one
  also ends with its condition: it is owed only while the state it names lasts.
- **Offered by an action**: an action that proposes an `offerFollowUp` change
  naming a follow-up stores it as an ephemeral offer when its changes are applied. That is how a
  moment the fields can't show is offered: which spell a cast spent a slot on.

computeSheet lists both in `offers` ([engine-core.md](engine-core.md#the-offer-list)).

```yaml
followUps:
  # 5E: experience that earns a level the character doesn't have offers the level-up.
  - id: level-up
    while: xp.levelUp
    action: level-up
  # 5E: a concentrating creature that takes damage makes a concentration check.
  - id: concentration
    on: { field: hp.current, tags: [damage], once: true }
    required: true
    when: concentration.active && change.taken < 0
    action: concentration-check
    params:
      damage: -change.taken
  # Mothership: maximum wounds calls for a death save.
  - id: dying
    becomes: wounds.current >= wounds.max
    required: true
    action: death-save
```

- **A trigger**, at most one of (with none, only an `offerFollowUp` change offers it):
  - **`while: <condition>`**: a derived offer, offered whenever the condition
    holds on the current character. Re-evaluated after every change, so experience that earns two
    levels offers one level-up, and then the next.
  - **`on: { field, tags?, once? }`:** fires once for each entry of the batch's `adjustments` on
    the field whose tags include one of `tags` (a tag matches its subtags), or any entry when
    `tags` is left out. Overflow entries count, so health overflowing into a wound fires `on`
    wounds. Formulas see the entry as `change` ([formulas.md](formulas.md#context-roots)). With
    `once: true` it fires at most once per batch, on the matching entries summed
    (below).
  - **`becomes: <condition>`:** fires once when the condition is false on the character before
    the batch and true after it, and not again while it stays true. It is a state, not an event:
    at most one copy from a declaration is stored (a copy still stored isn't stored
    again), and a stored one is deleted after any batch that leaves the condition false, or
    leaves the character without its content; computeSheet doesn't offer it meanwhile. Mörk
    Borg's broken roll at exactly 0 HP ends when HP rises above 0 or drops below it. `when` isn't
    part of the condition: it only gates the moment it fires. A consequence that must happen even
    if the state later changes is an event: use `on` (an `on` offer lasts until run or
    dismissed, one per hit).
- **A derived offer tests the imbalance itself**: "the
  experience earns more levels than the character has" (`xp.current >= xp.nextLevel`, where the
  next level's total follows the level), never a proxy such as "experience changed since the last
  level-up". Then taking the offer and editing the sheet by hand (raising the level, then filling
  the new level's pending choices) both end it the same way. The build can't check this; authors
  must. A condition that can't be written that way is a moment (`becomes`), not a derived offer.
- **Offered by an action**: an action step's or option's `changes`, or the
  changes content adds to a tagged step, may propose `{ type: offerFollowUp,
  followUp: <id>, params? }`. `followUp` is a follow-up of the content whose option or added
  changes propose it (or of its content type), else of the content defining the action, else of
  the rules; `params` are formulas the action evaluates, which replace the declaration's own.
  The change always goes to the actor. applyChanges stores the follow-up as an ephemeral offer,
  with no `cause`, before those the batch triggers, if the character still has it after the
  batch and its `when` and action hold, as for a triggered one. A follow-up with no trigger is
  offered only this way; an `on` or `becomes` one may be offered too, and a `while` one never is.
  A follow-up's own `changes` can't offer one.

  ```yaml
  # orc-2e: blood magic after a bloodline spell, or a gift spell cast from a slot.
  followUps:
    - id: blood-magic
      action: blood-magic
  effects:
    - target: { steps: [spell.paid] }
      op: changes
      when: "action.item.id in sorcerer.gifts && (flags.mode == 'spontaneous' || flags.pooled)"
      value:
        changes:
          - { type: offerFollowUp, followUp: blood-magic, params: { rank: flags.rank } }
  ```

- **`when`** (optional): evaluated on the character after the whole batch (ephemeral) or on the
  current character (derived).
- **`required`** (optional, default false): the rules mandate it (dying, death
  saves, a concentration check), so an app shouldn't let the player skip it. It is advisory: the
  engine blocks no change or action, it is not a rules issue, and an ephemeral one can still be
  dismissed. Interrupts the player may decline (5E's Relentless Endurance) aren't required.
- **`change.taken`** is the amount after incoming-change effects (resistance)
  and before absorbing fields (temporary hit points) and clamping; `change.requested` is the
  amount before effects.
- **`once`**: `change` is the matching entries summed: `by`, `requested` and
  `taken` the sums, `tags` the union in entry order, `reason` the first entry's, `clamped` true
  if any was. `when` is evaluated once, on the sum. A batch is one action's changes as the app
  applies them, so "once per batch" is "once per source" when the app applies each attack's
  changes as one batch; an app that applies two attacks in one batch gets one follow-up. 5E's
  concentration check (above) fires once per hit, however many damage types it deals, with the
  damage the creature took.
- **A consequence**, exactly one of:
  - **`action`**, a rules action (local or qualified ID) or, on content, also one of the content's
    own, with `params` formulas. Parameters it doesn't fix are the app's to supply. An ephemeral
    offer keeps the parameters as evaluated when it fired.
  - **`changes`**, proposed changes resolved like an action's `changes` step (no `split`);
    `entry: self` is the content's copy. A change may compute its field and repeat with
    `forEach`; each copy counts toward `maxFollowUps`, and a computed field
    that names no input field, like a formula that fails, leaves the follow-up out. An ephemeral
    offer stores what it fired on and resolves its changes when listed, so they are never stale.
  - **`create: { link, start, params? }`**, a derived offer only: a new
    character for one of the character's empty link slots. `link` is a slot the pack sees;
    `start` a creation start ([Creation](#creation)) by its `id`, or `<pack>:<id>`; `params`
    formulas for the start's action's parameters, evaluated on this character. The start's pack
    must be the slot's `pack` or a dependency of it, since the new character uses the slot's
    pack. It is offered while `while` and `when` hold and the slot is empty (no saved link and no
    view), so saving the link ends it. The app makes the file, runs the start on it and saves the
    link ([characters.md](characters.md#creating-a-character)). Not with `on`, `becomes`, `to` or
    another consequence (`invalid-create-offer`); a start from another pack is
    `link-start-mismatch` when the slot's pack is loaded too, and `pnpm validate` checks it and
    the parameters always.

    ```yaml
    # mork-borg-core: a finished owner of the gore-hound without its sheet is offered one.
    followUps:
      - id: hound-sheet
        while: '!character.creating && companions.hound'
        create:
          link: hound
          start: companion
          params: { companion: "'mork-borg-core:companions.ancient-gore-hound'" }
    ```

    A pack asks for a linked sheet this way, not with a constraint on the empty slot: a missing
    sheet the owner's rules can do without is an offer the player may decline, not a broken rule.
- **`to`** (optional): `self`, the default, or `{ link: <slot> }`, the character filling one of
  the character's link slots. A follow-up to a link names that character's action, fields and
  content by qualified ID, as changes sent to a link do. An ephemeral one is stored on the
  character whose change fired it, marked for the link with the linked character's ID: the app
  that holds both files finds it in this character's `offers` (`to.link`, `character`), runs it
  on the linked character, and clears it here.
- **On content.** Content types and items may declare `followUps` too. They apply while the
  character has the copy or pick (not content in the `applied` list), and their formulas see
  `item` and `self`.
- Ephemeral follow-ups fire on the batch as a whole, never per change: a long rest's eight changes
  are one batch. Applying a follow-up's changes is a new batch, which may fire follow-ups of its
  own.
- Text: `followUps.<id>.name` and `followUps.<id>.description` for the rules',
  `<contentId>.followUps.<id>.…` and `types.<type>.followUps.<id>.…` for content's, all optional
  ([i18n.md](i18n.md)).
- Level-up after experience thresholds is a `while` follow-up naming the pack's level-up action.
  Milestone leveling has no trigger: the app offers the action.

## Creation

`creation` lists the ways a pack starts a character. Each **start** names a
rules action and, optionally, parameters for it:

```yaml
# mork-borg-core rules/creation.yaml
creation:
  - { id: classless, action: create-character, params: { classless: true }, random: true }
  - { id: class, action: create-character, random: true }
```

- `id`: the start's ID, named by `creation.<id>.name`.
- `action`: a rules action. Every parameter it requires must be in `params` (`missing-param` at
  load otherwise). Creation actions are usually `available: character.creating`.
- `params`: literal parameter values, so starts can share an action.
- `random` (default false): an automatic run (every checkpoint `auto`) makes a character the
  source's own random creation could produce. Set it only when the source creates characters at
  random; otherwise an automatic run gives a default character, each step's recommendation.
  `pnpm validate` warns about a step of a random start's action (or an action it runs) that would
  pause in an automatic run: a choice step over a written list, or an `allocate` step, without
  `recommend`.

Packs' starts are concatenated in load order, and a later start with the same `id` replaces the
earlier one in its place; the ruleset lists them as `creation`, each with its qualified `action`
and the `pack` that names it. An app offers, for a new character with `creating: true`:

| Mode   | Offered for           | Runs                                                                     |
| ------ | --------------------- | ------------------------------------------------------------------------ |
| Random | a start with `random` | the action, policy `{ dice: auto, choices: auto, allocations: auto }`    |
| Guided | every start           | the action, policy `{ dice: pause, choices: pause, allocations: pause }` |
| Manual | always                | nothing; the player fills in a blank sheet                               |

The policy's rules allow mixes ("roll the stats, let me pick the class"). A creation action ends
by proposing `finishCreation`, which clears `creating` once nothing is missing
([characters.md](characters.md#creating-a-character)). A pack without starts supports manual
creation only.

## Always-on effects and character-level choices

- `effects` in a rules document are always active: a critical hit doubling damage dice, for example.
- `choices` in a rules document are made at the character level, such as picking a playbook. Picks are stored in the character's top-level `choices` ([characters.md](characters.md)).
- `immuneTo` in a rules document lists immunities every character has while their `when` holds,
  as content's do ([content.md](content.md#when-content-is-active)) but
  without `scope`. A game whose stat blocks list condition immunities reads them from an input
  set field:

  ```yaml
  # packs/5e/srd-5.1/rules/conditions.yaml
  fields:
    conditions.immunities: { type: set, of: condition, input: true, default: [] }
  immuneTo:
    - id: listed
      query: { type: condition, where: item.id in conditions.immunities }
  ```

  The `immune` issue's ID is the pack plus the immunity's ID (`5e-srd-5.1:listed`).

- `templateFields` in a rules document declares item fields every template may set: a magic weapon's
  rarity, attunement, charges and bonuses. They merge across packs by name, and a copy's `item` has
  each one its content type doesn't declare. See [content.md](content.md#templates).

- `standardCopies` in a rules document lists queries whose matching items every character holds
  a copy of, without the file listing them: FitD gear a table tags `standard`. A
  content item may declare them too, for copies that exist while it is active (the ritual FitD's
  Ritual ability starts with). See [content.md](content.md#standard-copies).

  ```yaml
  # packs/fitd/scoundrel/rules/gear.yaml
  standardCopies:
    - { type: gear, where: "'standard' in item.tags" }
  ```
