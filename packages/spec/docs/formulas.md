# Formulas

The formula language computes field values, conditions, effect values, query filters and rolls.
It is OCF's own language. Its syntax, edge-case rules and type checking borrow from
[CEL](https://cel.dev), and it adds dice notation. It is "CEL-like", not CEL: OCF claims no
compatibility, and the places where it differs from CEL are listed [at the end](#differences-from-cel).

Formulas are not JavaScript or any other general-purpose code. Packs are untrusted, and every
language must be able to evaluate them safely:

- There are no loops and no user-defined functions, so every formula finishes. The only
  repetition is the [aggregates](#aggregates), which go once over the character's copies, the
  ruleset's fields or a list, and nest only in a list function's list argument. [`maxOf`, `minOf` and `dieOf`](#reading-dice-values)
  read a dice value without rolling it: they skip rerolls and explosions, so they finish too.
- Formulas can't reach anything outside the character and the ruleset.
- The same inputs always give the same output. Dice are rolled only when an action rolls them,
  through the swappable dice function.

A formula is released as **text** (for people) and a **tree** (plain JSON, for machines). The
reference tooling converts both ways: a parser (text → tree) and a printer (tree → canonical text).

## Lexical structure

Whitespace (space, tab, CR, LF) separates tokens and is otherwise ignored.

| Token      | Form                                                  | Notes                                                                           |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| Identifier | `[A-Za-z_][A-Za-z0-9_]*`                              | Not a reserved word                                                             |
| Integer    | `0` or `[1-9][0-9]*`                                  | No sign, no leading zeros; at most 2^53 − 1                                     |
| Decimal    | `[0-9]+ "." [0-9]+`                                   | Both sides need digits; no exponent; six places kept ([Types](#types))          |
| String     | `'…'` or `"…"`                                        | Escapes: `\\ \' \" \n \r \t \uXXXX`                                             |
| ID literal | `"@" ID`                                              | Content, a field, a type, an action or a link slot: [ID literals](#id-literals) |
| Dice       | `COUNT "d" SIDES MODIFIERS`                           | See [Dice notation](#dice-notation)                                             |
| Operators  | `+ - * / % == != < <= > >= && \|\| ! ? : ( ) [ ] , .` |                                                                                 |

**Reserved words:** `true`, `false`, `null` and `in` are keywords. The following are reserved for
future use and can't be identifiers: `as break const continue else for function if import let
loop package namespace return var void while`.

## Grammar

```ebnf
Expr           = Or [ "?" Or ":" Expr ] ;
Or             = And { "||" And } ;
And            = Relation { "&&" Relation } ;
Relation       = Addition { ( "<" | "<=" | ">" | ">=" | "==" | "!=" | "in" ) Addition } ;
Addition       = Multiplication { ( "+" | "-" ) Multiplication } ;
Multiplication = Unary { ( "*" | "/" | "%" ) Unary } ;
Unary          = Postfix | "!" Unary | "-" Unary ;
Postfix        = Primary { "." IDENT | "[" Expr "]" } ;
Primary        = IDENT "(" [ Expr { "," Expr } ] ")"      (* function call *)
               | IDENT                                    (* name *)
               | "(" Expr ")" [ DICE_SUFFIX ]             (* grouping, or a computed dice count *)
               | "[" [ Expr { "," Expr } ] "]"            (* list *)
               | INT | DECIMAL | STRING | ID | DICE | "true" | "false" | "null" ;
```

- Binary operators are left-associative. The conditional `?:` is right-associative.
- **Precedence**, lowest to highest: conditional, `||`, `&&`, relations, `+ -`, `* / %`, unary,
  postfix.
- **Functions** are called by bare name only. `a.b(x)` (a method call) is a syntax error.
- **Names:** an identifier followed by `.identifier` segments is one dotted name
  (`abilities.str.mod`, `steps.attack.total`). It resolves as a whole; see [Names](#names).
- A **dice suffix** (`d6kh1`) directly after `)`, with no whitespace between, makes the
  parenthesized expression a computed dice count: `(ratings.skirmish)d6kh1`.

### ID literals

An **ID literal** is `@` followed by an ID, local (`@classes.fighter`) or
qualified (`@5e-srd-5.1:classes.fighter`): segments of letters, digits and `_` joined by `.` or
`-`, optionally after a pack ID and `:`. A trailing `.` or `-` isn't part of it. Its value is a
string: the ID resolved as a data field's reference is, in the scope of the pack the formula
belongs to, giving the qualified ID of the content item, field, content type, rules action or
link slot it names, looked up in that order. So a formula writes its own pack's IDs short, as
data does:

```yaml
when: item.class == @classes.fighter && @feats.toughness in feats.held
```

- **Checked.** The type checker reports an ID literal that names nothing the pack sees as
  `unknown-name`, so a misspelt ID is a build error rather than a comparison that is always
  false. A qualified ID of a pack the ruleset doesn't load (a link's, a participant's) is kept
  as written and isn't checked.
- **Evaluated** in the formula's pack; one that names nothing is `unknown-name`. Outside a pack
  (the formula conformance cases), it is the ID as written.
- **Passed on.** A formula an action passes on to applyChanges (a `where`, a per-copy `by`) has
  its ID literals replaced by the qualified IDs, as string literals, as it has the action's
  values.
- An ID can't be computed: `'orc-2e:spells.repertoire.rank' + string(slot)` stays a
  string.
- In the tree, `{ type: ref, id }`; the printer writes `@<id>`.

## Dice notation

```ebnf
DICE        = COUNT DICE_SUFFIX ;          (* 2d20kh1; no whitespace inside *)
COUNT       = INT ;
DICE_SUFFIX = "d" SIDES { MODIFIER } ;
SIDES       = INT [ "z" ] | "%" | "F" ;    (* z: zero-based, faces 0 to INT-1; d% is d100; dF is Fate *)
MODIFIER    = ( "kh" | "kl" | "dh" | "dl" ) [ INT ]      (* count, default 1 *)
            | "!!" [ COMPARE ] | "!" [ COMPARE ]         (* default: = the highest face *)
            | "ro" COMPARE | "r" COMPARE
            | "cs" COMPARE | "cf" COMPARE
            | "min" INT | "max" INT ;
COMPARE     = [ "=" | "<" | "<=" | ">" | ">=" ] INT ;    (* a bare INT means "=" *)
```

- A dice literal always has a count: `1d20`, not `d20`. On its own, `d20` is an identifier.
- Modifier spellings map to the [dice modifiers](../data/dice-modifiers.json):
  - `kh` keepHighest, `kl` keepLowest, `dh` dropHighest, `dl` dropLowest
  - `!` explode, `!!` explodeCompound
  - `r` reroll, `ro` rerollOnce
  - `cs` countSuccesses, `cf` countFailures
  - `min` minimum, `max` maximum
- Each modifier type may appear at most once.
- The parser stores modifiers in **application order**, whatever order they were written in:
  reroll, rerollOnce, explode, explodeCompound, minimum, maximum, keep/drop,
  countSuccesses, countFailures. So `1d20r1kh1` and `1d20kh1r1` give the same tree and print the
  same.
- Only one keep or drop modifier is allowed per term.
- Explode modifiers are not allowed on Fate dice.
- Sides must be at least 1. Counts are bounded by the `maxDicePerItem` safety limit.

**Zero-based dice**: `dNz` rolls faces 0 to N − 1, so `1d100z` reads 00–99 as
Mothership does. Keep and drop compare face values, so `2d100zkl1` keeps the true lowest
reading. `z` follows numeric sides only (`d%z` and `dFz` are syntax errors). The tree stores
`zero: true` on the dice node, and the printer writes `z` after the sides.

## The tree

The tree is plain JSON; its schema is
[`formula.schema.json#/$defs/tree`](../schemas/formula.schema.json). Every node has a `type`.

| `type`        | Fields                                                                | Example text        |
| ------------- | --------------------------------------------------------------------- | ------------------- |
| `int`         | `value` (integer ≥ 0)                                                 | `3`                 |
| `decimal`     | `value` (number ≥ 0, rounded to six places)                           | `0.5`               |
| `string`      | `value`                                                               | `'fire'`            |
| `ref`         | `id` (an ID literal, without the `@`)                                 | `@classes.fighter`  |
| `bool`        | `value`                                                               | `true`              |
| `null`        | —                                                                     | `null`              |
| `list`        | `items`                                                               | `[1, 2]`            |
| `name`        | `path` (identifiers)                                                  | `abilities.str.mod` |
| `member`      | `object` (not a `name`), `name`                                       | `f(x).y`            |
| `index`       | `object`, `index`                                                     | `xs[0]`             |
| `call`        | `fn`, `args`                                                          | `max(a, b)`         |
| `unary`       | `op` (`-`, `!`), `operand`                                            | `-x`                |
| `binary`      | `op`, `left`, `right`                                                 | `a + b`             |
| `conditional` | `test`, `then`, `else`                                                | `a ? b : c`         |
| `dice`        | `count` (integer, or a node), `sides` (integer or `"F"`), `modifiers` | `2d20kh1`           |

- Literals are never negative: `-1` is `unary(-, int 1)`.
- `d%` is stored as `sides: 100`.
- A computed count that is a plain integer literal is stored as an integer, so `(3)d6` is `3d6`.
- Dice modifier objects use the roll-item shape: `{ type, count }` for keep and drop, `{ type, target }` for minimum and maximum, `{ type }` for an explode at the highest face,
  and `{ type, compare, target }` for the rest.

**Round trips are exact.** For any tree the parser produced, `parse(print(tree))` gives back an
identical tree. The printer always produces the same canonical text:

- Single spaces around binary operators, `?` and `:`; none after unary operators.
- `, ` between arguments and list items; no spaces inside parentheses or brackets.
- Strings in single quotes.
- Decimals in their shortest round-trip form: the fewest significant digits that parse back to the same double, choosing the digits closest to the exact value when several are equally short (as ECMAScript's Number-to-String, Ryu and Grisu do). Written out in full without an exponent, always with a `.` (`2.0`, `0.0001`, `123456789012345690000000.0`).
- Dice as `NdS` followed by modifiers in application order, `=` comparisons written bare
  (`r1`, `cs>=5`).
- Parentheses only where precedence needs them. The right operand of a binary operator at the
  same precedence, a conditional used as a test or as a then-branch, and a computed dice count
  are always parenthesized.

Source files may be written in any layout; releases carry the canonical text.

## Types

| Type      | Values                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------- |
| `int`     | Whole numbers from −(2^53 − 1) to 2^53 − 1                                                        |
| `decimal` | IEEE 754 double-precision numbers, finite only, rounded to six places ([Six places](#six-places)) |
| `bool`    | `true`, `false`                                                                                   |
| `string`  | Unicode text                                                                                      |
| `null`    | `null` (only from data: optional values that are absent are not null, they are missing)           |
| `list<T>` | Ordered lists; `set` fields are lists without duplicates                                          |
| `dice`    | An unrolled dice expression: dice terms plus a flat integer (`2d6 + 3`)                           |
| `dyn`     | Not known until evaluation (context data the checker can't type yet)                              |

### Six places

Decimals keep six places, so sums of short decimals are exact: ten Bulk of 0.1
make 1, fifty coins of 0.02 lb make 1, and `0.1 + 0.2 == 0.3`.

- **Where.** The result of every operator and function that gives a decimal (`+`, `-`, `*`, `/`,
  unary `-`, `min`, `max`, `abs`, and the aggregates' sums, at each step, highest and lowest); a
  decimal literal, when parsed; a decimal field's value (an input's saved value when read, a
  formula's result, and each effect step); a decimal item field, state value or computed value;
  context-root data that isn't whole; and the amounts of a change. Ints are unaffected; an int
  mixed into a decimal operation is exact.
- **How.** The exact value of the double is rounded to the nearest multiple of 10⁻⁶, ties away
  from zero, and the result is the double nearest that decimal. It is decided on the double's
  exact binary value, not on a printed form, so every implementation gets the same double: the
  double nearest 0.0000005 is a little below it and rounds to 0, while 1 / 128 (0.0078125
  exactly) is a tie and rounds to 0.007813. A port with a decimal type can round there; others
  decompose the double (sign, exponent, significand), as the reference engine's
  `formula/values.ts` does. A rounded zero is 0, never −0.
- **Consequences.** Sums, differences and products of decimals with up to six places are exact
  within ±2^53 × 10⁻⁶ (about 9 × 10⁹). `/` gives six places (`1 / 3` is 0.333333). Equality,
  comparison and `floor`, `ceil`, `round` and `trunc` see the rounded value, as does every
  rounding to an integer (an integer field's final rounding, a `multiply` effect). Printing is
  unchanged: 0.3 prints as `0.3`.
- **Literals** with more than six places are rounded when parsed, so their tree holds the
  rounded value; the build warns about them (`pnpm validate`), since the text no longer says
  the value.

**Field types map to formula types:**

| Field type             | Formula type   |
| ---------------------- | -------------- |
| `integer`              | `int`          |
| `decimal`              | `decimal`      |
| `boolean`              | `bool`         |
| `string`, `enum`, `id` | `string`       |
| `dice`                 | `dice`         |
| `set`                  | `list<string>` |

`int` is assignable wherever `decimal` is expected, and `int` is assignable wherever `dice` is
expected. Nothing else converts implicitly.

## Operators

| Operator    | Operands → result                                                                                        | Notes                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `+`         | int,int → int; numbers → decimal; string,string → string; list,list → list; dice with dice or int → dice | Mixing int and decimal gives decimal                                                                                                 |
| `-`         | numbers as for `+`; dice with dice or int → dice                                                         |                                                                                                                                      |
| `*`         | numbers; dice and int (either order) → dice                                                              | Dice times an int scales every term's count and the flat part: `2 * (1d6 + 1)` is `2d6 + 2`                                          |
| `/`         | numbers → **decimal**                                                                                    | Always decimal, to six places. Round explicitly with `floor`, `ceil`, `round`, `trunc`                                               |
| `%`         | int,int → int                                                                                            | Sign of the dividend (truncated remainder)                                                                                           |
| unary `-`   | int, decimal, dice                                                                                       |                                                                                                                                      |
| `!`         | bool → bool                                                                                              |                                                                                                                                      |
| `< <= > >=` | numbers (mixed allowed), or string,string                                                                | Strings compare by code point                                                                                                        |
| `== !=`     | any two values                                                                                           | Values of different kinds are unequal; int and decimal compare numerically; lists compare element by element. Dice can't be compared |
| `in`        | T, list<T> → bool                                                                                        | Membership                                                                                                                           |
| `&& \|\|`   | bool → bool                                                                                              | Evaluated left to right, short-circuit                                                                                               |
| `?:`        | bool, T, T → T                                                                                           | Only the chosen branch is evaluated                                                                                                  |
| `xs[i]`     | list<T>, int → T                                                                                         | Zero-based                                                                                                                           |

Branches of `?:` must have compatible types: the same type, int with decimal (→ decimal), int with
dice (→ dice), or `dyn` with anything.

**A `null` parameter**. An `action` step's `params` (and a handoff's, and a
follow-up's) may give `null`, which leaves the parameter out: an optional one takes its default
or stays absent, a required one is `missing-param`. So `has(params.bonus) ? params.bonus : null`
passes an optional parameter on as it came. In those `params`, and only as the
formula's result (a `?:` branch, a `?:` nested in one, or the whole formula), the checker lets a
`null` branch take the other branch's type; `null` inside an operator or a function argument is
still a type mismatch.

## Names

A dotted name resolves in this order:

1. **Context root.** If the first segment is a context root bound where the formula appears
   (`item`, `self`, `steps`, …), the rest of the path selects inside it. Roots are
   [listed below](#context-roots). Field IDs must not start with a root's name, so this is never
   ambiguous.
2. **Field.** Otherwise, the whole dotted name must be a field ID visible from the pack (its own
   fields, then its dependencies'). Its type is the field's formula type.
3. Otherwise the formula is rejected with `unknown-name`.

Field references are what the build uses to work out dependencies and the calculation order.
Formulas that depend on each other in a loop are rejected with `circular-formula`, where the build
can see it.

## Context roots

Which roots are bound depends on where the formula appears. The checker rejects a root used where
it is not bound (`unknown-name`).

**Root types.** Roots are typed where the place makes their shape known. A **closed** object
rejects keys it doesn't declare (`unknown-name`); an **open** one types the keys it knows and
treats the rest as `dyn`:

| Root                    | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item`, `base`, `prior` | Closed: `id`, `type`, `tags` and the content type's item fields. In an action, `item` is typed only when every user of the action has the same content type; otherwise `dyn`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `self`                  | Open: `id`, `equipped`, `quantity`, `templates` and the declared state keys. Open because picked or granted content sees its owner's copy. The copy's computed values are typed in its own actions and follow-ups, those declared earlier in a computed value, and `unknown-name` everywhere else, though `self` is open                                                                                                                                                                                                                                                                                                                                                                |
| `params`                | Closed: the action's declared parameters. A field parameter is closed: `id`, `type`, `tags` (list of strings) and `value`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `steps`                 | Closed: each step ID. A roll step has `total`, `faces`, `kept`, `empty`, `band`, `bandSet`, `bandValue` (`dyn`), `dice`, `tallies` (closed: the visible roll tallies, each int), `bounds`, `unbounded` and `rolls` (a list of closed `{ total, kept, items }`, `items` `dyn`); a choice step `picked` (a list of strings with `repeat`, or over pending choices, with `paths`), and over content or copies without `repeat` `item` (and `self` over copies), typed by the content type, and over values without `repeat` `value`, typed as `picked.value` is; a choice or changes step `added` (a list of strings); an action step `result`, `data`; an allocate step `amounts` (`dyn`) |
| `flags`                 | Closed: every flag any branch or written option of the action sets (each `dyn`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `situational`           | Closed: the situational choices visible from the pack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `roll`                  | In a result band, closed: `total`, `faces`, `kept`, `empty`, `tallies`, `rolls` (as a roll step's), and in the bands of a set with a `value` `value`, typed as that formula. In a roll effect, open: `item`, `self`, `tags`, `total`, `faces`, `kept`                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `pick`                  | Closed: `id`, `value`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `value`                 | A value choice's or a choice step's candidate value: `string`, `int` or `decimal` as its written values are, the element type of a `values` formula, else `dyn`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `choice`                | In a choice's own `where`, `eligible`, `recommend` and `values`: closed, `path`, `owner`, `id` (strings but `path`), `slot` (a slot's), and `picks` (a list of its picks, `dyn`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `slot`                  | int: the slot's number in a slotted choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `action`                | Closed: `item` and `self` (typed as the action's own), `step` (closed: `id`, a string, and `tags`, a list of strings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `picks`                 | int                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `picked`                | Closed: `id` (a string), plus `item` over content and copies and `self` over copies, typed by the content type, and `value` over values, typed as written values are (a formula's: `dyn`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `field`                 | Closed: `id` (a string), `value` (int)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `amount`                | int                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `options`               | list of strings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `part`                  | Closed: `total`, `tag`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `incoming`              | Closed: `amount` (decimal), `field` (string), `tags` (list of strings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `change`                | Closed: `by`, `requested`, `taken` (decimals), `reason` (string), `clamped` (bool), `tags` (list of strings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `batch`                 | Closed: `adjustments`, a list of `{ field, by, requested, reason, clamped, tags }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `character`             | Closed: `id` (string, the file's `id`), `inventory`, `features` (lists), `creating` (bool), `applied` (a list of closed `{ id, source, active, state }`, `state` `dyn`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `links`                 | Closed: one view per link slot visible from the pack (its own first). A view is closed: `id` (a string) and each declared field, typed by its declaration and nested at the dots of its field ID                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `copy`                  | Open: `id`, `item`, `type`, `templates` (strings and a list of strings), `tags` (list<string>), `equipped` (bool), `quantity` (int); `state` and `fields` are `dyn`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `entry`                 | Open: `id` (a string) and the state keys the query's content type declares, typed by their declarations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `f`                     | Closed: `id`, `type` (strings), `tags` (list<string>), `value` (`dyn`). In a field function's `cond`, `value` can't be read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `x`                     | The list's element type (`dyn` for a `dyn` list)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `participants`          | Closed: each role the action declares, a list of views; a view is closed like a link's                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `participant`           | In an `each: <role>` step: that role's view                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

In roll effects and option effects, `steps`, `flags` and `params` are `dyn`, because the effect
applies to many actions; so are their `action.item` and `action.self`, and a roll effect's or
result band's `participants` and `participant`.

**Roll effects**. A roll effect's formulas see the content's own roots (`item`, `self`)
with the action context (`steps`, `flags`, `params`, `situational`, `participants`,
`participant`), `roll`, and `action`: the action's own item, copy and step. So an item's effect
tests its own copy (`self.equipped && self.attuned`) whichever copy makes the roll, and compares
it with the roll's (`action.self.id == self.id`). `roll.item` and `roll.self` are the action's
item and copy too, without computed values.

**Each steps**. In an `each: <role>` step, `participant` is bound and an earlier
`each` step over the same role reads as the current participant's result; elsewhere an `each`
step's result is a list, one per participant.

**A choice step's candidates.** In a choice step over content or copies, `where` and `prefer`
bind `item` to the candidate's item and, over copies, `self` to the candidate copy (over
content `self` isn't bound). The action's own item and copy are then `action.item` and
`action.self`. Over values, `where` and `prefer` bind `value` to the candidate, and `item` and
`self` stay the action's own.

**Options content adds.** An `option` effect's `when` and its option's `changes`
see the content's own roots (`item`, `self`) with the action context (`steps`, `flags`, `params`,
`situational`) and `action`; `when` also sees `picks`, and the changes `picked`.

| Root                       | Bound in                                                                                                                                                                           | Meaning                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `character`                | everywhere                                                                                                                                                                         | The character as a whole                                                                                                                                                          |
| `links`                    | everywhere `character` is, except queries, item fields and state defaults and bounds                                                                                               | The characters filling the link slots, as views; an empty slot is absent                                                                                                          |
| `item`                     | queries; content effects, grants, prerequisites, choices; actions; item fields; state defaults and bounds; display groups and state hints                                          | The query candidate, or the item (base plus templates); in an actions display group, the listed action                                                                            |
| `base`                     | templates, and a template's item field values                                                                                                                                      | The item the template is applied to, alone                                                                                                                                        |
| `prior`                    | a template's item field values                                                                                                                                                     | The item as merged before the template: the base item and the copy's earlier templates                                                                                            |
| `self`                     | content effects, grants, prerequisites, choices, follow-ups, computed values; actions; content display groups and state hints; kept templates' queries and `params` (the keeper's) | The character's copy of the item. For content activated by a pick or a grant: the owning copy, with the pick's or grant's own state keys over it; for an applied entry, the entry |
| `pick`                     | choice effects                                                                                                                                                                     | The picked option (`pick.id` or `pick.value`)                                                                                                                                     |
| `value`                    | a value choice's `where`; a choice step's `where` and `prefer` over values                                                                                                         | The candidate value                                                                                                                                                               |
| `choice`                   | a choice's `where`, `eligible`, `recommend` and value `values`; a choice step's `recommend` over pending choices                                                                   | The choice itself with its own `picks`; the pending choice a step asks                                                                                                            |
| `slot`                     | every formula of a slotted choice and of its inline options                                                                                                                        | The slot's number                                                                                                                                                                 |
| `steps`, `flags`, `params` | actions; roll and option effects; situational effects; result bands                                                                                                                | Earlier step results, branch flags, app parameters                                                                                                                                |
| `params`                   | a template's item field values                                                                                                                                                     | The template's params, as the content keeping it gave them ([content.md](content.md#from-the-keeper))                                                                             |
| `situational`              | actions; roll and option effects; situational effects; incoming-change effects                                                                                                     | Selected situational choices: the action's, or the receiving player's on the change being routed                                                                                  |
| `roll`                     | roll effects; situational effects; result bands                                                                                                                                    | The roll being made or classified                                                                                                                                                 |
| `participants`             | actions; roll effects; situational effects; result bands                                                                                                                           | The other characters taking part, by role, as views                                                                                                                               |
| `participant`              | `each` steps; roll effects, situational effects and result bands during one                                                                                                        | The current participant's view                                                                                                                                                    |
| `part`                     | proposed adjusts with `split`                                                                                                                                                      | The tag group being emitted (`part.total`, `part.tag`)                                                                                                                            |
| `incoming`                 | incoming-change effects' `when`, `value` and `then`                                                                                                                                | The adjust being routed: its requested `amount`, `field` and `tags`                                                                                                               |
| `change`                   | `on` follow-ups' `when`, `params` and `changes` (a stored one's `changes` when listed)                                                                                             | The adjustment that triggered the follow-up, or with `once` the matching ones summed                                                                                              |
| `batch`                    | Formulas applyChanges evaluates: `copies`/`applied` queries and per-entry `by`, `value`; an `applyEffect` state `{ formula }`                                                      | The batch's earlier field adjustments on the character                                                                                                                            |
| `action`                   | a choice step's `where` and `prefer` over content, copies or values; option and roll effects; formulas a change passes on                                                          | The action's own `item`, `self` and current `step`                                                                                                                                |
| `picks`                    | a choice step's written options' `when`, and its `where` and `prefer` over content, copies or values; an option effect's `when`                                                    | How many times the step has already picked the candidate                                                                                                                          |
| `picked`                   | a choice step's and its options' `changes`, and its options' `flags`                                                                                                               | The pick: `id`, plus `item` and (copies) `self`, or (values) `value`                                                                                                              |
| `field`                    | an `allocate` step's `limit` and `cost`                                                                                                                                            | The field being allocated to: `id` and its computed `value` before the step                                                                                                       |
| `amount`                   | an `allocate` step's `cost`                                                                                                                                                        | The amount allocated to the field                                                                                                                                                 |
| `options`                  | a choice step's `recommend`                                                                                                                                                        | The IDs its source offers, without `#done` or added options                                                                                                                       |
| `copy`                     | the arguments of `countCopies`, `sumCopies`, `maxCopies` and `minCopies`                                                                                                           | The copy the argument is being evaluated for                                                                                                                                      |
| `entry`                    | an immunity query's `where`                                                                                                                                                        | The candidate applied entry: `id` and its state keys, as its `self`                                                                                                               |
| `f`                        | the arguments of `countFields`, `sumFields`, `maxFields` and `minFields`                                                                                                           | The field the argument is being evaluated for                                                                                                                                     |
| `x`                        | the arguments of the list functions (`countList` … `sortList`), after the list; a proposed change with `forEach`                                                                   | The list element the argument, or the change, is being evaluated for                                                                                                              |

**Formulas a change passes on.** In a proposed change aimed at copies, `copies.where` and a `by` or
`value` that reads `self` or `item` are evaluated per copy by applyChanges. There `item` and `self`
are the matching copy's, and `character` and fields are bound. They may also read `steps`, `flags`,
`params` and `action` (not `situational`, `roll`, `part` or `picked`): the action substitutes each
maximal path rooted at one of them with its value as a literal, and `has()` of one with `true` or
`false`, before passing the change on ([engine-actions.md](engine-actions.md), "Other steps"). Such
a path must not be a map (`type-mismatch`). In a change an app gives to applyChanges, these four
names are `unknown-name`. A change aimed at applied entries passes on `applied.where` and its
per-entry `by` or `value` the same way; there `item` is the entry's source item (typed `dyn`, since
it may be of any content type) and `self` the entry: `id` and its state keys, with declared
defaults.

Details of each root are in [`data/formula-context.json`](../data/formula-context.json).

## Functions

The standard library is a fixed set, versioned with the spec like the dice modifiers. Packs can't
define functions.

| Function                              | Signature                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `min`, `max`                          | (number, number, …) → int or decimal        | One or more arguments; int only when all are int                                                                                                                                                                                                                                                                                                                                      |
| `floor`, `ceil`, `round`, `trunc`     | (number) → int                              | `round` rounds half away from zero                                                                                                                                                                                                                                                                                                                                                    |
| `abs`                                 | (int) → int; (decimal) → decimal            |                                                                                                                                                                                                                                                                                                                                                                                       |
| `size`                                | (list or string) → int                      | String length in code points                                                                                                                                                                                                                                                                                                                                                          |
| `string`                              | (int, string or bool) → string              | The value as text: `string(3)` is `'3'`, `string(true)` is `'true'`, a string is itself; a decimal is `type-mismatch`                                                                                                                                                                                                                                                                 |
| `count`                               | (list<T>, T) → int                          | How many members equal the value                                                                                                                                                                                                                                                                                                                                                      |
| `indexOf`                             | (list<T>, T) → int                          | The first position of a member equal to the value, −1 if none: `indexOf(['a', 'b'], 'b')` is 1                                                                                                                                                                                                                                                                                        |
| `maxOf`, `minOf`                      | (dice) → int                                | The highest and lowest totals a dice value can roll. See [below](#reading-dice-values)                                                                                                                                                                                                                                                                                                |
| `dieOf`                               | (dice, int count?) → dice                   | `count` dice (default 1) of the value's first die: `dieOf(2d6 + 1)` is `1d6`, `dieOf(2d6, 3)` is `3d6`                                                                                                                                                                                                                                                                                |
| `fieldOf`                             | (string pattern, key, …) → the fields' type | The field a family pattern names for its keys: `fieldOf('spellcasting.{caster}.dc', 'wizard')`. The pattern is a string literal with one or more `{family}` placeholders, each family once, and takes a key per placeholder in order: `fieldOf('slots.{caster}.rank{rank}', 'wizard', 3)`. Every field it names must exist and share a type. A key not in its family is `no-such-key` |
| `keysOf`                              | (string family) → list                      | A family's values, in order: ints when every value is a whole number, else strings. The name is a string literal                                                                                                                                                                                                                                                                      |
| `countOf`                             | (dice) → int                                | The count of the value's first die: `countOf(8d6)` is 8; 0 with no dice                                                                                                                                                                                                                                                                                                               |
| `has`                                 | (name or member) → bool                     | Macro: whether an optional value is present. The argument isn't evaluated, so a missing value is `false`, not an error                                                                                                                                                                                                                                                                |
| `countCopies`                         | (bool cond) → int                           | Macro: the character's copies for which `cond` holds. See [Aggregates](#aggregates)                                                                                                                                                                                                                                                                                                   |
| `sumCopies`, `maxCopies`, `minCopies` | (number value, bool cond?) → number         | Macro: the sum, highest or lowest of `value` over the copies for which `cond` holds (every copy, without it); 0 for none                                                                                                                                                                                                                                                              |
| `countFields`                         | (bool cond) → int                           | Macro: the fields in the ruleset for which `cond` holds                                                                                                                                                                                                                                                                                                                               |
| `sumFields`, `maxFields`, `minFields` | (number value, bool cond?) → number         | Macro: the sum, highest or lowest of `value` over the fields `cond` keeps (every field, without it); 0 for none                                                                                                                                                                                                                                                                       |
| `countList`                           | (list, bool cond) → int                     | Macro: the list's elements for which `cond` holds                                                                                                                                                                                                                                                                                                                                     |
| `sumList`, `maxList`, `minList`       | (list, number value, bool cond?) → number   | Macro: the sum, highest or lowest of `value` over the elements `cond` holds for (every element, without it); 0 for none                                                                                                                                                                                                                                                               |
| `filterList`                          | (list<T>, bool cond) → list<T>              | Macro: the elements `cond` holds for, in order                                                                                                                                                                                                                                                                                                                                        |
| `mapList`                             | (list, value) → list                        | Macro: `value` for each element, in order                                                                                                                                                                                                                                                                                                                                             |
| `sortList`                            | (list<T>, key?) → list<T>                   | Macro: the elements in ascending order of `key` (number or string; the element itself without one), equal keys in list order (0114)                                                                                                                                                                                                                                                   |
| `hasChoice`                           | (string type) → bool                        | Whether the character has a choice of the content type, made or pending. Bound only in display hints' `showWhen`; [below](#choices-in-display-hints)                                                                                                                                                                                                                                  |
| `picksOf`                             | (string choice) → list                      | The saved picks of a choice of the formula's owner: content IDs or values, in saved order. The ID is a string literal. Bound where a formula has an owner; [below](#picks-of-the-owners-choices)                                                                                                                                                                                      |
| `countEquipped`                       | (string type) → int                         | **Deprecated:** `countCopies(copy.type == type && copy.equipped)`. The character's equipped copies of a content type                                                                                                                                                                                                                                                                  |
| `countState`                          | (string key) → int                          | **Deprecated:** `countCopies(has(copy.state.<key>) && copy.state.<key>)`. The copies whose per-copy state `key` is `true`                                                                                                                                                                                                                                                             |
| `sumState`                            | (string type, string key) → int             | **Deprecated:** `sumCopies(copy.state.<key>, copy.type == type && has(copy.state.<key>))`. Sum of an integer state key over the copies of a type                                                                                                                                                                                                                                      |

The copy and field functions and the deprecated three read the character, so they are only
bound where a character is: everywhere except queries resolved at load time, item fields, and
state defaults and bounds. Elsewhere they are `unknown-function`. `picksOf` reads the character
too, and is bound in fewer places ([below](#picks-of-the-owners-choices)). The list functions and
`indexOf` read only their arguments, so they are bound everywhere.

### Choices in display hints

`hasChoice(type)` is true when computeSheet's [choice list](engine-core.md#the-choice-list)
has an entry whose `type` is the content type: an applicable choice drawing from it, made or
pending. A local type ID resolves in the formula's pack, as a field ID does
(`hasChoice('subrace')` in `5e-srd-5.1` is `5e-srd-5.1:subrace`). A display group of picked
content shows for the characters who can gain it, homebrew that brings the same choice
included, without naming the items that bring it:

```yaml
- id: subraces
  kind: content
  showWhen: hasChoice('subrace')
  members: { type: subrace }
```

- **Where:** only in display hints' `showWhen` (a group's, a field hint's, a content type's
  state hint's); anywhere else it is `unknown-function`. Choices depend on fields (a choice's
  `when`, `pick`), so a field or effect that read them could loop; display hints never feed
  back into a calculation.
- **Checks:** the argument is a string (`type-mismatch`). A literal that names no content type
  the pack sees is `unknown-reference` at load.
- **computeSheet** evaluates field and group `showWhen` itself
  ([display-hints.md](display-hints.md#shown)). Apps evaluating a state hint's bind it from
  `sheet.choices`, resolving the argument in the hint's pack scope as they resolve field names.

### Picks of the owner's choices

`picksOf(choice)` is the list of a choice's saved picks: content IDs (qualified) or values, in
saved order, `[]` when it has none. The choice is one of the **formula's owner**: the content or
rules that declare the formula, as activated on the character. So a choice reads a sibling's
picks, and a copy's values and actions read its own:

```yaml
# A background's +1 recommends the best ability the +2 hasn't taken (5E). The two choices are
# siblings in the inline option `two-and-one`, which owns them.
- id: plus-one
  unique: increase
  uniqueScope: owner
  from: { values: [int, wis, cha] }
  recommend: >-
    sortList(filterList(['int', 'wis', 'cha'], !(x in picksOf('plus-two'))),
      -fieldOf('abilities.{ability}.base', x))[0]
# A spirit's summoning commits Effort for its powers less one, at least 1 (CWN).
computed:
  effort: { type: integer, formula: "max(1, size(picksOf('powers')) - 1)" }
```

- **The owner** is the activation the formula runs in: a copy's item (its own choices, bare
  keys), a template or granted content on it (its choices, kept under prefixed keys), picked
  content or an inline option (the choices nested under the pick), or the rules. A choice's formulas see the choices of the choice's owner, its siblings and
  itself (`picksOf` of its own ID is `choice.picks`). A content type's formulas run for each item,
  and a rules action a copy uses (`use`) for that copy, so they see that item's choices; a rules
  action run with no copy, and the rules' effects, follow-ups and choices, see the rules-level
  choices. Content a choice picks doesn't see the choices of the content that picked it.
- **The ID** is a string literal (`type-mismatch` otherwise): a choice ID, or a slot's key
  (`class-feat-2`). Choice IDs have hyphens, which a dotted name can't, so the picks are a
  function rather than a root. Where the owner is known at load (an item's, a template's or an
  inline option's formulas), a literal that names none of its choices is `unknown-reference`;
  elsewhere a name the owner lacks is `no-such-key` when evaluated.
- **Saved picks.** It reads the character file's picks as saved, whether or not the choice
  applies (`when`) and whether or not they are eligible (the issues report those). Picks are
  input, not calculated, so reading them adds no dependency and can't loop: two choices may
  each read the other. A `recommend` sees its sibling's picks, not its recommendation, so the
  choice answered first decides. A step over pending choices builds the proposed sheet again
  before each pick, so a later choice sees an earlier one's pick.
- **Where:** in content formulas (effects, roll and option effects included; grants;
  prerequisites; a choice's `when`, `pick`, query `where`, `eligible`, `recommend`, `values` and
  `effects`; computed values; actions; follow-ups; a `keepsTemplates` entry's query and `params`,
  reading the keeper's) and in the rules' choices, effects, follow-ups and actions. A query `where` that calls it reads the character, so it isn't resolved at load.
  Field formulas, constraints, display hints, situational choices, result bands, queries
  resolved at load, item fields, and state defaults and bounds have no owner: there it is
  `unknown-function`.

The deprecated functions keep working in this spec version. Each is the `countCopies` or
`sumCopies` call shown, which official packs use instead. A later major version may remove them.

### Reading dice values

A weapon's damage is a whole dice value (`item.damage`). `maxOf`, `minOf`, `dieOf` and `countOf` look
inside one without rolling it.

```yaml
# Maximum damage when an omen is spent (MÖRK BORG).
dice: 'situational.omenDamage ? maxOf(item.damage) : item.damage'
# One more of the weapon's dice on a critical hit, not doubled (5E's Savage Attacks).
value: dieOf(roll.item.damage)
multiplied: false
```

- **`maxOf(dice)`:** every die of a term with a positive sign shows its highest face (sides;
  sides − 1 for `dNz`; 1 for Fate dice), and every die of a negative term its lowest. Rerolls
  and explosions don't happen: an exploding die has no highest total, so it counts once at its
  highest face. The term's other modifiers then apply as in
  [Rolling dice values](#rolling-dice-values): clamp, keep or drop, count successes. The result
  is the flat part plus each term's value times its sign. So `maxOf(4d6kh3)` is 18,
  `maxOf(2d6 + 3)` is 15, `maxOf(1d6 - 1d4)` is 5, `maxOf(1d100z)` is 99 and
  `maxOf(1d20cs>=15)` is 1.
- **`minOf(dice)`:** the reverse: positive terms show their lowest face (1; 0 for `dNz`; −1 for
  Fate dice), negative terms their highest. `minOf(4d6kh3)` is 3, `minOf(1d6min3)` is 3, and
  `minOf(1d6r1)` is 1, since the reroll doesn't happen.
- **`dieOf(dice, count?)`:** `count` dice of the value's **first term**: its sides, `z` flag and
  Fate-ness, with no modifiers and a positive sign. The flat part and every other term are
  dropped, so `dieOf(2d6 + 1)` is `1d6` and `dieOf(1d8 + 2d6)` is `1d8`. `count` defaults to 1;
  `0` gives `0dN`. A value with no terms (an int, or a weapon whose damage is a flat `1`) gives
  the dice value with no terms, which adds nothing to a roll.
- **`countOf(dice)`**: the count of the value's **first term**, 0 for a value
  with no terms: `countOf(8d6)` is 8, `countOf(2d6 + 1d4)` is 2. With `dieOf` it scales a
  spell's damage: `item.damage + dieOf(item.damage, slot - 3)` is 8d6 and a die per slot level
  above 3rd.
- **Multiplying.** `dice * int` (or `int * dice`) multiplies every term's count and the flat
  part, keeping the modifiers: `item.damage * 2` doubles a weapon's dice, `2 * (1d6 + 1)` is
  `2d6 + 2`, `3 * 4d6kh3` is `12d6kh3`. A negative int is `type-mismatch`; a count over
  `maxDicePerItem` is `safety-limit-exceeded`.
- **Arguments.** An int argument is a dice value with no terms, so `maxOf(7)` is 7. Anything
  else is `type-mismatch`, and so is a `count` that isn't an int or is negative. A `count` over
  `maxDicePerItem` is `safety-limit-exceeded`, as for a computed count in dice notation.
- **Binding.** None of them reads the character, so they are bound everywhere.

### Aggregates

The aggregates count, add up, or take the highest or lowest of something over a set: the
character's copies, the ruleset's fields, or a list. They are one family:

| Over   | Count             | Sum                 | Highest, lowest                          | Root   |
| ------ | ----------------- | ------------------- | ---------------------------------------- | ------ |
| Copies | `countCopies(c)`  | `sumCopies(v, c?)`  | `maxCopies(v, c?)`, `minCopies(v, c?)`   | `copy` |
| Fields | `countFields(c)`  | `sumFields(v, c?)`  | `maxFields(v, c?)`, `minFields(v, c?)`   | `f`    |
| A list | `countList(l, c)` | `sumList(l, v, c?)` | `maxList(l, v, c?)`, `minList(l, v, c?)` | `x`    |

The list family also has `filterList`, `mapList` and `sortList`, which give lists ([below](#over-a-list)).

```yaml
# Normal items carried (MÖRK BORG).
formula: "countCopies(copy.type in ['weapon', 'armor', 'shield', 'ammo', 'scroll']) + load.extra"
# Pounds carried (5E).
formula: sumCopies(copy.fields.weight * copy.quantity, has(copy.fields.weight))
# The best Armor rating among the character's extras (Fate).
formula: "maxCopies(copy.fields.armor, copy.type == 'extra' && copy.fields.armor > 0)"
# A bow's attack needs arrows left. The outer `item` is still the bow.
available: "!has(item.ammo) || countCopies(copy.type == 'ammo' && copy.fields.kind == item.ammo && copy.quantity > 0) > 0"
# Skills at Great, and the highest skill, homebrew skills included (Fate).
formula: "sumFields(f.value == 4 ? 1 : 0, 'skill' in f.tags)"
formula: "maxFields(f.value, 'skill' in f.tags)"
# The best of a group's handed-off results (FitD).
result: >-
  ['failure', 'partial', 'success', 'critical'][
    maxList(steps.rolls, indexOf(['failure', 'partial', 'success', 'critical'], x.result))]
```

What they share:

- **They are macros**, like `has`: the arguments are not evaluated before the call. They are
  evaluated once per element, with the aggregate's root (`copy`, `f` or `x`) bound to it. A
  list function's list is evaluated once, first, as usual.
- **The root** is bound only inside the arguments (for the list functions, those after the
  list); elsewhere it is `unknown-name`. Field IDs can't start with `copy`, `f` or `x`, as with
  any root.
- **Other roots stay bound.** `item`, `self`, `steps` and the rest keep their meaning inside the
  arguments, so a weapon's condition can compare its own `item.ammo` with each `copy`. The
  field functions' `cond` is the exception (below).
- **Order.** `cond` is evaluated first and `value` only where it holds, so `has()` in `cond`
  guards `value`. An error for any element is the call's error.
- **Empty.** With nothing kept, every aggregate that gives a number gives the int 0, the
  highest and lowest included, so the result can be used in arithmetic. `filterList`,
  `mapList` and `sortList` give the empty list.
- **Types.** `cond` must be bool and `value` a number (`type-mismatch`), but for `mapList`,
  whose `value` may be anything, and `sortList`, whose key is a number or a string. The checker types a
  sum, highest or lowest as int when `value` is int, decimal when it is decimal, and `dyn` when
  it is `dyn`. When evaluated, the result is a decimal if any value it went over is a decimal,
  else an int; an empty result is the int 0, which is assignable wherever a decimal is expected.
  A decimal sum is rounded to six places at each step, as `+` is.
- **No nesting.** Inside any aggregate's arguments, no aggregate is bound (`unknown-function`),
  but for a list function's list argument, which is evaluated once, outside the per-element
  context.
  The work is at most the number of copies, fields or list elements times the formula's size,
  and each is bounded, so no safety limit is added for it. The deprecated functions stay bound
  there.
- **Where.** The copy and field functions read the character, so they are bound where a
  character is (see [Functions](#functions)). The list functions read only their arguments and
  are bound everywhere; the list argument decides what they reach (`steps` only in actions, and
  so on).

#### Over copies

`countCopies(cond)`, `sumCopies(value, cond?)`, `maxCopies(value, cond?)` and
`minCopies(value, cond?)` go over every copy the character has: the `inventory`, then
`features`, each in file order. Copies whose item isn't in the ruleset are
skipped, as in `character.inventory`; `applied` entries aren't copies.

- **`copy`** holds:
  - `id`, `item` (the qualified item ID), `type` (the content type name), `equipped`,
    `quantity` and `templates`, as in `self` and `character.inventory`;
  - `tags`: the base item's tags, then each template's, as in `item.tags`;
  - `state`: each declared state key, its saved value or default, as in `self.<key>`;
  - `fields`: the item fields, as in `item.<field>` (computed from input fields only): the
    last of the copy's templates to give one, else the item's value, else the
    declared default; with the template fields the content type doesn't declare.

  A key that is absent (an item field the item doesn't set and whose declaration has no
  default, a state key its type doesn't declare) is `no-such-key`; guard it with `has()`.
  `copy.state` and `copy.fields` are `dyn`, since one call spans many content types, so
  `sumCopies`, `maxCopies` and `minCopies` over them are `dyn`.

- **Dependencies.** Copy state, `quantity` and item fields don't depend on computed fields, so
  the calls add no ordering edges of their own; field names inside the arguments are
  dependencies like anywhere else. In activation conditions only input fields may be read, as
  always.

#### Over fields

`countFields(cond)`, `sumFields(value, cond?)`, `maxFields(value, cond?)` and
`minFields(value, cond?)` go over every field in the ruleset, in ruleset order (load order, then
declaration order), so a field a later pack adds is counted by an earlier pack's formula.

- **`f`** is closed: `id` (the qualified field ID), `type` (the declared value type, such as
  `integer`), `tags` (the written tags, `[]` if none: a computed tag is the
  sheet's and isn't seen here) and `value` (the field's value, as reading the field gives it).
  It is the view a field parameter's `where` sees, plus `value`. `f.value`
  is `dyn`, so `sumFields`, `maxFields` and `minFields` over it are `dyn`.
- **`cond` is a static filter.** It may read only `f.id`, `f.type` and `f.tags`: reading
  `f.value`, `f` as a whole, a field or any other root there is `type-mismatch`. So the fields
  it keeps are fixed per ruleset, and engines may work them out once. To count by value, sum
  instead: `sumFields(f.value == 4 ? 1 : 0, 'skill' in f.tags)`.
- **Dependencies.** A `sumFields`, `maxFields` or `minFields` call depends on exactly the fields
  its `cond` keeps (every field, without it); `countFields` reads no value and depends on none.
  A field whose formula aggregates over a set that holds the field itself is `circular-formula`,
  as for any loop. In activation conditions only input fields may be read: a kept field that
  isn't an input is `unknown-name` there when its `value` is read.

#### Over a list

`countList(list, cond)`, `sumList(list, value, cond?)`, `maxList(list, value, cond?)` and
`minList(list, value, cond?)` go over a list's elements in order, as do
`filterList`, `mapList` and `sortList` (below).

- **`x`** is the element, typed as the list's element type (`dyn` for a `dyn` list). `list`
  must be a list (`type-mismatch`).
- **Null elements are skipped.** An `each` step's list holds null for a participant its `when`
  skipped; those elements aren't evaluated or counted.
- **`cond` may read anything**, `x` included: a list is already a value, so there is no set to
  fix at load and no dependency of its own. Names inside the arguments are dependencies as
  anywhere.
- **`indexOf(list, value)`** isn't a macro, but goes with them: it turns a name into a rank, so
  `maxList` can find the best of a list of results. Equality is as for `in` and `count`, so
  `indexOf([1, 2], 2.0)` is 1.
- `count(xs, v)` stays; it is `countList(xs, x == v)`. There is no `any` or `all`:
  `countList(…) > 0` and `countList(…) == size(…)` say them.

**Lists from lists**. Three list functions give a list instead of a number:

- **`filterList(list, cond)`:** the elements `cond` holds for, in list order, each as it is in
  the list. The checker types it as the list's type.
- **`mapList(list, value)`:** `value` for each element, in order: a list of the value's type.
- **`sortList(list, key?)`:** the elements in ascending order of `key`, evaluated once per
  element; without `key`, the elements themselves are the keys. Keys must all be numbers (int
  and decimal compare by value) or all strings (compared as `<` compares them); anything else,
  or a mix, is `type-mismatch`. Equal keys keep their list order, so the sort is stable and
  every engine gives the same list. Descending is a negated key: `sortList(l, -x)`.

Null elements are skipped, as for the others, so the result has none. A list function's list
argument is evaluated once, outside the per-element context, so it may itself be an aggregate:
`sortList(filterList(l, x > 0))`, or the k-th highest roll, `sortList(rolls, -x)[k]`. Inside the
other arguments no aggregate is bound, as before.

```yaml
# 5E's random start: the six rolled totals, highest first, go to the class's abilities in
# priority order.
flags:
  sorted: sortList(mapList(steps.rolls, x.total), -x)
# The options a pick hasn't taken yet.
recommend: filterList(options, !(x in steps.earlier.picked))[0]
```

## Evaluation and errors

Evaluation returns a value or an **error** with a stable code. An error propagates through every
operator and function that receives it. `&&`, `||` and `?:` never evaluate an operand they don't
need, so an error there doesn't matter.

| Code                    | When                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `formula-syntax`        | Text doesn't parse (data: `offset`, `expected`)                                                                   |
| `unknown-name`          | A name is neither a bound root nor a visible field                                                                |
| `unknown-function`      | A function isn't in the standard library, or isn't bound here                                                     |
| `wrong-arity`           | Wrong number of arguments                                                                                         |
| `type-mismatch`         | An operator, function or place gets a type it doesn't accept                                                      |
| `division-by-zero`      | `/` or `%` by zero                                                                                                |
| `overflow`              | An int result outside ±(2^53 − 1), or a decimal result that isn't finite                                          |
| `no-such-key`           | A path under a root names something absent (use `has()`)                                                          |
| `index-out-of-range`    | `xs[i]` with `i` outside the list                                                                                 |
| `circular-formula`      | Fields that depend on each other in a loop                                                                        |
| `safety-limit-exceeded` | Text longer than `maxFormulaLength`, nesting deeper than `maxFormulaDepth`, or a dice count over `maxDicePerItem` |

A field whose formula errors is reported with its error, and so is every field that depends on it.
Everything else still calculates.

### Expected types by place

| Place                                                                                                | Must be                                   |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Conditions: `when`, `where`, `showWhen`, `available`, prerequisites, constraint `check`, band `when` | bool                                      |
| Field `formula`                                                                                      | the field's formula type                  |
| Field `min`, `max`                                                                                   | number                                    |
| Effect `value` on a field: `set`                                                                     | the field's type                          |
| Effect `value` on a field: `add`, `atLeast`, `atMost`                                                | the field's type (numbers)                |
| Effect `value`: `multiply`                                                                           | number                                    |
| Effect `value` on rolls: `add`                                                                       | dice (int allowed)                        |
| Effect `value` on incoming changes: `add`                                                            | dice (int allowed)                        |
| Effect `value` on incoming changes: `set`, `atLeast`, `atMost`                                       | number                                    |
| Roll part `dice`                                                                                     | dice (int allowed)                        |
| Roll part `value`                                                                                    | number                                    |
| Roll part `field`                                                                                    | string (a field ID)                       |
| Choice `pick`, `min`, `max`                                                                          | int                                       |
| An aggregate's `cond`                                                                                | bool                                      |
| An aggregate's `value`                                                                               | number                                    |
| A list function's list                                                                               | list                                      |
| `maxOf`, `minOf`, `dieOf` and `countOf` argument                                                     | dice (int allowed)                        |
| `dieOf` `count`                                                                                      | int                                       |
| Choice step `recommend`                                                                              | string                                    |
| Choice step `prefer`                                                                                 | number                                    |
| Display group `sectionBy`                                                                            | int or string                             |
| Display group `sortBy`                                                                               | number or string                          |
| Choice step `repeat` `max`, `min`                                                                    | int                                       |
| Allocate step `budget`, each of `values`, `limit`, `cost`, each `recommend` amount                   | int                                       |
| Proposed `choose` `option`; a computed `path.choice`                                                 | string; list of strings                   |
| Proposed change `by`                                                                                 | number                                    |
| Proposed change `value`                                                                              | any                                       |
| Action step `params`                                                                                 | any (`null` leaves it out)                |
| Action step `source`; each of `participants`                                                         | string; list of strings                   |
| Computed tag (`{ formula }` in a tags list)                                                          | string or list of strings (declared tags) |
| Item field values                                                                                    | the declared type                         |
| State key `default`                                                                                  | the key's type                            |
| State key `min`, `max`                                                                               | number                                    |

## Rolling dice values

A `dice` value is rolled only where an action rolls it (a roll step) and where applyChanges routes
an adjust through an incoming-change `add` with dice
([engine-core.md](engine-core.md#dice-on-incoming-changes)). The formula layer defines how one term
is rolled from supplied faces, so every engine computes the same result.

1. **Initial dice.** Request `count` faces.
2. **Process each die in order.** Exploded dice are added to the end and processed in turn.
   - **reroll:** while the face matches the comparison, request a new face. The old face is
     marked `rerolled`.
   - **rerollOnce:** the same, at most once.
   - A reroll modifier with a `count` (only from a `reroll` roll modifier; it has
     no dice notation) rerolls at most that many of the initial dice that match, chosen before
     any is rerolled: the lowest faces first, earliest first among equal faces.
   - **explode:** if the face matches (default: the highest face, sides − 1 for `dNz`), request one more die, marked
     `exploded`.
   - **explodeCompound:** the same, but the new face adds into this die instead of becoming a
     new die.
   - Rerolls are limited by `maxRerolls` per term, explosions by `maxExplosions`.
3. **minimum, maximum:** clamp each face.
4. **Keep or drop:** keepHighest/keepLowest keep N dice; dropHighest/dropLowest drop N. Ties go to
   the die rolled first. N larger than the number of dice keeps (or drops) them all.
5. **Value of the term:**
   - With countSuccesses: the number of kept dice matching its comparison, minus those matching
     countFailures.
   - Otherwise: the sum of kept faces.

The dice value's total is its flat part plus each term's value times its sign. Faces must be in
range for the die (1 to sides; 0 to sides − 1 for a zero-based `dNz`; −1 to 1 for Fate dice); a supplied face out of range is an
`invalid-face` error.

## Details

These follow from the rules above; they are spelled out because implementations have to agree.

- **Parsing**
  - `(a).b` is the dotted name `a.b`: parentheses only group, and a `member` node never holds a
    `name`.
  - Reserved words can't be path segments either (`a.return` is a syntax error), and so can't be
    part of a field ID.
  - Dice are read greedily: `1d6!=5` (no spaces) is an explode on 5, printed `1d6!5`. Write
    `1d6 != 5` for a comparison, which is a type error anyway, since dice can't be compared.
  - A literal dice count over `maxDicePerItem` is rejected when parsing
    (`safety-limit-exceeded`). A computed count is checked when evaluated. A negative, decimal or
    non-number count is `type-mismatch`.
  - `0d6` is valid; it rolls no dice and its value is 0.
- **Dice values**
  - Dice values keep their terms as written; equal terms are not merged (`1d6 + 1d6` has two
    terms).
  - Negating a dice value flips every term's sign and the flat part.
  - A formula with no dice, rolled, is its own value with no terms.
- **Rolled faces**
  - Faces are listed in the order they were rolled, which is the order they are supplied in. A
    reroll's new face goes at the end of the list; the old face stays where it was, marked
    `rerolled`.
  - Flags (`rerolled`, `exploded`, `success`, `failure`) appear only when true.
  - A compounded die is one face whose value is the sum of its rolls.
  - Clamped faces (`min`, `max`) show the clamped value.
- **Values and functions**
  - `has()` with anything but a name or member path is `type-mismatch`. A name whose root isn't
    bound, and that isn't a field, is `unknown-name` even inside `has()`.
  - Context-root data is plain JSON: whole numbers are `int`, others `decimal` (rounded to six
    places). Field values take the field's declared type, so a `decimal` field holding 2 is
    `2.0`.
  - Lists compare element by element with the usual equality, so `[1] == [1.0]` and
    `2.0 in [1, 2]` are true.

## Differences from CEL

- `/` always returns a decimal. In CEL, int / int is integer division.
- int and decimal mix in arithmetic, giving a decimal. CEL requires explicit conversion.
- Decimals are rounded to six places after every operation. CEL's doubles aren't.
- `&&` and `||` evaluate left to right and short-circuit. CEL's are commutative: an error on
  either side is absorbed when the other side decides the result.
- A missing value is an error (as in CEL), but there are no protocol-buffer messages, maps or
  `has()` on map keys. `has()` takes a name or member path.
- Dice notation and the `dice` type are OCF additions.
- No method calls, bytes, unsigned integers, timestamps or durations. The only macros are `has`
  and the [aggregates](#aggregates), which bind fixed roots (`copy`, `f`, `x`) instead of a
  variable the formula names; there are no comprehension macros (`all`, `exists`, `filter`,
  `map`).
- Values of different kinds compare unequal (as in CEL's heterogeneous equality). Dice can't be
  compared.
