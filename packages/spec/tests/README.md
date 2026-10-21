# Shared test suite

The test suite is how every engine, the TypeScript reference engine and community ports alike, proves it implements a spec version. A port is conformant when it passes every case for the spec versions it claims. **Cases are plain data** (YAML in, YAML out), so any language can run them without TypeScript.

> Spec 0.1: cases exist for the formula language and every engine call.

## Layout

```
tests/cases/<area>/<case-name>/
  case.yaml        # what is being tested
  character.yaml   # input character (when the call takes one)
  changes.yaml     # applyChanges input
  dice.yaml        # individual die faces to supply, in order
  expected.yaml    # the expected output
```

| Area        | Call(s)                         | Typical inputs                                                    |
| ----------- | ------------------------------- | ----------------------------------------------------------------- |
| `formulas/` | parse, print, evaluate          | formula text or tree, a context (field values, `item`, `self`, …) |
| `sheets/`   | `computeSheet`                  | packs, character, competing-option picks                          |
| `options/`  | `listOptions`                   | packs, character, choice path                                     |
| `changes/`  | `applyChanges`                  | packs, character, changes, `strict`                               |
| `actions/`  | `startAction`, `continueAction` | packs, character, action, params, situational, policy, die faces  |
| `upgrades/` | `upgrade`, `checkRelease`       | old and new packs, character                                      |
| `loads/`    | `loadRuleset`                   | packs                                                             |

## Formula cases

Formula cases are tiny, so `formulas/` holds one YAML file per topic (`formulas/<topic>.yaml`),
each with a list of cases, instead of one folder per case:

```yaml
description: Operator precedence and associativity
specVersion: 0.1.0
cases:
  - name: multiplication binds tighter than addition
    parse: '1 + 2 * 3' # text to parse
    tree: { type: binary, op: '+', … } # expected tree (optional)
    print: '1 + 2 * 3' # expected canonical text of the parsed tree (optional)

  - name: unknown dice modifier
    parse: '1d20kx1'
    error: formula-syntax # expected error code instead of a tree

  - name: floor of a negative half
    evaluate: 'floor((abilities.str.score - 10) / 2)'
    fields: # fields visible to the formula: type, value and (for the field functions) tags
      abilities.str.score: { type: integer, value: 9, tags: [ability] }
    roots: # bound context roots and their data (dyn)
      item: { tags: [martial] }
    character: # the copies, for the copy aggregates (as `copy`) and the deprecated three;
      # `character: false` leaves the copy and field functions unbound
      copies: # each is the `copy` root; see the note below for missing keys
        - { type: weapon, equipped: true, state: { attuned: true }, fields: { weight: 3 } }
    value: -1
    valueType: int # int | decimal | bool | string | null | list | dice

  - name: dividing by zero
    evaluate: '1 / 0'
    error: division-by-zero

  - name: a condition must be boolean
    check: 'abilities.str.score' # type-check only
    fields: { abilities.str.score: { type: integer } }
    roots: [item] # bound roots (names only)
    rootTypes: # optional: types of bound roots; closed objects reject unknown keys
      item: { object: { damage: dice }, open: false }
    expect: bool # expected result type for this place (optional)
    error: type-mismatch # or `type: int` for the inferred type

  - name: advantage keeps the higher die
    roll: '2d20kh1 + 3' # evaluate, then roll with the supplied faces
    faces: [4, 17] # consumed in order, one per requested die
    total: 20
    terms: # optional: per dice term, every face with its flags
      - faces:
          - { value: 4, kept: false }
          - { value: 17, kept: true }
```

- A copy in `character.copies` gives its `type`; missing keys take defaults: `equipped` false,
  `quantity` 1, `tags` and `templates` `[]`, `state` and `fields` `{}`, and an `id` and `item`
  of the runner's choosing. Copies are in order (inventory first, as engines list them).
- `picks` binds `picksOf`: the formula's owner's choices by key, each a list of its picks
  (`picks: { plus-two: [str], languages: [] }`). Without it, `picksOf` is unbound.
- The case's `fields` are also the ruleset's fields that `countFields`, `sumFields`,
  `maxFields` and `minFields` go over, in the order given; `f.id` is the key, `f.type` the
  `type` and `f.tags` the `tags` (default `[]`).
- `value` is compared as data; `valueType` disambiguates `2` (int) from `2.0` (decimal), which
  YAML can't.
- A dice value (`valueType: dice`) is compared as `{ terms: [{ sign, count, sides, modifiers }],
  flat }`.
- Error cases compare only the `code`.

## `case.yaml`

```yaml
description: Advantage keeps the higher d20
specVersion: 0.1.0 # the earliest spec version this case applies to
call: startAction
packs: # pack sources, in load order
  - path: ../../../../../packs/5e/srd-5.1 # a repo pack, by path, or…
  - inline: { manifest: …, rules: …, content: [] } # …a small pack release written inline
input: # any other call inputs (action, params, situational, policy, strict, links, …)
  action: { id: weapon-attack, entry: inv-1 }
  situational: { 5e-srd-5.1:advantage: true }
  policy: { dice: pause }
```

- **Packs** given by `path` are pack source folders (like `packs/5e/srd-5.1`); the runner builds
  each into a pack release before calling `loadRuleset`. `tests/packs/` holds test-only packs with
  made-up content: `test-gear`, a weapon for the Mothership cases, `test-borg-gear`, gear for the
  MÖRK BORG cases, `test-effects`, rules for stacking, multiplying and issue order, `test-actions`,
  actions of picked content, `test-follow-ups`, follow-ups after changes (and once per batch),
  `test-situational`, situational choices for rolls and incoming changes, `test-immunity`, immunity
  to applied content, `test-standard`, standard copies, `test-choice-picks`, a choice's own picks,
  `eligible` and repeatable content and waived prerequisites (0092), `test-kept-templates`,
  templates content keeps on copies and on picked or granted content, `test-applied`, actions
  that apply content and change applied entries, `test-roll-twice`, rolls made more than once
  (`of: roll`), and `test-owner-picks`, formulas reading their owner's picks with `picksOf`.
- **How outputs compare.** Only what `expected.yaml` lists is compared. A key the call doesn't
  define, in `case.yaml` or `expected.yaml`, is a mistake in the case: runners fail it rather
  than ignore it, so a case never seems to test something it doesn't.
  - **`computeSheet`:**
    - `values`: listed fields only, comparing `value` (or `error.code`), and `base` and `breakdown`
      (exact) when listed, and `tags` (exact, `[]` for a field with none), and `name` (exact, `null`
      for a field with none). Dice values are compared as canonical text.
    - `effects`: the exact list.
    - `pending`: the exact list of choice paths.
    - `pendingSlots`: the exact list of the pending choices' `slot` (`{ choice, number }`), in
      order, `null` for a choice without slots.
    - `issues`: the exact list of `{ code, id }`, in order.
    - `actions`: the exact list of `{ action, entry, source }`.
    - `situational`: the exact list of offered situational choice IDs, in order.
    - `competing`: for each listed field, every entry for that field, in order, comparing `op`,
      `stackKey`, `options` (option IDs, or `{ id, value }` to compare values too),
      `recommended` and `applied` when listed.
    - `errors`: the exact list of codes.
    - `valueErrors`: the exact list of fields whose value is an error, in order (`[]` for a
      character that computes cleanly, such as a blank one).
    - `copies`: the exact map of computed values per copy.
    - `standardCopies`: the exact list of `{ entry, item, saved }`.
    - `activations`: the exact list.
    - `choices`: the exact list of `{ path, owner, id, slot, min, max, picks, open }`.
    - `copyLimits`: the exact list of `{ type, max, perItem, count, entries }`.
    - `offers`: the exact list.
  - **`listOptions`:**
    - `options`: the exact list, in order. Each is compared as
      `{ option, eligible, picked, recommended }`, with `reasons` as the list of `{ code, id }`, in
      order.
    - `min`, `max`: as given.
  - **`applyChanges`:** a case may give `dice.yaml`, a flat list of faces for a dice function;
    without it, the call gets no dice function.
    - `ok`, and `errors` as codes.
    - `issues` as for computeSheet; for a rejected batch, the issues it returns (strict mode's,
      and finishCreation's `creation-incomplete`).
    - `adjustments`: the exact list.
    - `followUps`: the exact list of the follow-ups the batch stored.
    - `changes`: the exact batch as applied, with the faces it rolled.
    - `character`: listed top-level keys, each compared in full; `null` means the key is absent
      (a file with no stored follow-ups left).
- **`startAction` / `continueAction`** cases put the call inputs in `case.yaml` `input`
  (`action`, `params`, `situational`, `policy`, `links`, `participants`) and the die faces in
  `dice.yaml`:
  - **Automatic policy:** `dice.yaml` is a flat list, consumed in order by a dice function.
  - **Paused policy:** `answers` (a list of `{ faces }`, `{ option }`, `{ amounts }` for an
    allocation or, for a handoff, `{ outcome }`) is fed to `continueAction` in turn. A handoff always pauses, so a case with
    handoffs lists their outcomes in `answers` whatever its policy.
  - **Replay from answers**: a case may give `answers` in `input` instead, passed
    to startAction as they are. Runners also run every case with top-level `answers` a second
    way, as startAction with `input.answers`, and expect the same result (the same error codes
    for a case that fails or leaves answers over), with a fresh dice function from `dice.yaml`.

  `expected.yaml` compares:
  - `status`;
  - `outcome` (as given);
  - `proposedChanges` (exact, `step` and `character` included);
  - `log`: per entry `step`, `action`, `kind`, `by`, `faces`/`option`/`amounts`, `draw`, `index`,
    `participant`, `outcome`, `total`, `band`, `bandSet`, `bandValue`, `summary` (exact); items only
    when listed; `tallies` (exact) when listed, where `[]` means the entry has none; `rolls`
    when listed, each roll's `total` and `kept` exact and its `items` as `items` are, where
    `null` means the entry has none;
  - `needs` for a final paused result, on the keys it lists (`step`, `action`, `kind`, …);
  - `errors` codes, and `errorData`: per error, its `data` on the keys listed (a replay's
    `index` and `needs`).

- **`upgrade`** cases list the old and new packs as `from` and `to`. Packs are usually written
  inline as pack releases: `{ inline: { manifest, rules, content, upgrades } }`.
  `expected.yaml` compares:
  - `ok` / `errors`;
  - `character` (listed top-level keys);
  - `pending` (choice paths);
  - `report.values` (exact list);
  - `report.steps` (as `{ pack, from, to, op }`);
  - `report.errors` (codes);
  - `report.homebrew` (as `{ path, op }`).
- **`checkRelease`** cases give `previous` and `next` (inline releases), and optionally
  `dependencies: { previous, next }`, each a list of pack references.
  `expected.yaml` compares `ok`, `changes` (exact list of `{ kind, id }`) and `errors` (codes).
- **`loadRuleset`** cases list `packs`, usually inline. A case without `expected.yaml` expects the
  packs to load. Otherwise `errors` is the exact list of `{ code, cause, path }`: `cause` is
  `data.cause` (the formula error code of a `formula-error`) and `path` the error's JSON Pointer,
  each compared only when present. For packs that load, `conflicts` (when listed) is the exact
  list of the ruleset's conflicts, `creation` (when listed) the exact list of its creation
  starts, and `packs` (when listed) the exact list of its packs' `id`,
  `version`, `license`, `credit` and `notices`, the notices in order.
- **Dice** are always given as individual faces (`dice.yaml`: a list of face lists, one per pause, or a flat list consumed in order by a seeded dice function). Cases never depend on random numbers.
- **Expected outputs** (`expected.yaml`) are compared as data. For example, `computeSheet` cases may list only the fields they check (`values: { 5e-srd-5.1:combat.ac: { value: 17 } }`); unlisted output is not compared. Errors and rules issues are compared by `code` (and `id`), never by text.
- A case for a call that should fail lists the expected `errors` codes.

## Running

Each engine ships a small runner that walks `tests/cases/`, feeds each case to its own implementation, and compares the result. The reference runner will live in `@opencharacter/engine`. Cases must not depend on run order.
