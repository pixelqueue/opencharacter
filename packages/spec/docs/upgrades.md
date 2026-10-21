# Upgrades

Characters pin exact pack versions, and the app decides when, or whether, to upgrade a character.
Most new versions need no upgrade work: only base state is saved, so formula fixes and changed
item values just recalculate. A version that changes the **shape** of saved state ships an
**upgrade script**, and the build refuses to release it otherwise.

## What changes the saved state's shape

Between two releases of a pack, these differences are **shape changes**, because a saved
character could refer to something that no longer means the same:

| Change                                                                           | `kind`                 | Covered by                                  |
| -------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------- |
| A content item is removed                                                        | `content-removed`      | `renameContent` or `removeContent`          |
| An item's content type changes                                                   | `content-type-changed` | `removeContent`                             |
| An input field is removed, or stops being an input                               | `field-removed`        | `renameField` or `removeField`              |
| An input field's type changes, or an enum loses values                           | `field-type-changed`   | `mapValues` or `removeField`                |
| A state key is removed or its type changes (on a content type, item or template) | `state-removed`        | `renameState`, `removeState` or `moveState` |
| A choice is removed                                                              | `choice-removed`       | `renameChoice` or `removeChoice`            |
| An option is removed from a `values` or inline-options choice                    | `option-removed`       | `renameOption`                              |
| A new required choice appears on existing content or in the rules                | `choice-added`         | `requireChoice`                             |
| An existing item becomes standard (a standard copies query now matches it)       | `standard-copy-added`  | `adoptStandard`                             |

`standard-copy-added` is for an item of the pack, in both releases with the same
type, that the standard copies queries ([content.md](content.md#standard-copies)) match in the
new release but not the old: the rules' and every item's, whichever loaded pack declares them.
Saved characters hold the item as an ordinary entry, which would otherwise stay beside the new
standard copy. An item that stops being standard, and a new item that is standard from the start,
are not shape changes.

A choice's options are compared only where both releases write them. A `values` formula's
options are known only on a sheet, so written values it replaces are not `option-removed`, nor
are the options of a formula the old release had: a saved pick the formula no longer offers is
reported when the character is computed. A written list that loses a value is `option-removed`
as before.

Adding things (content, fields with a default, optional choices, state keys with a default) and
changing formulas, item field values, display hints and translations are not shape changes.
Deprecating an item (it stays, marked `deprecated`) is not a shape change.

**Change IDs** are qualified:

- content items and fields: `<pack>:<id>`;
- state keys: `<pack>:<type or item>/<key>`;
- choices on content: `<pack>:<item>/<choice>`;
- rules-level choices: `<pack>:<choice>`;
- choices nested in an inline option: the option's choice ID, then `/<option>/<choice>`
  (`<pack>:classes.operative/specialization/ghost/skill-feat`);
- removed options: `<choice id>/<option>`.

`changes` are listed in the table's order, then by ID. A field that stays but stops being an
input counts as `field-removed`. A new required choice that an existing choice was renamed to is
covered by that `renameChoice`.

## The build check

The build compares a pack's new release with its previous release (`checkRelease(previous,
next, dependencies)`). `dependencies` gives each side's dependency releases,
transitively (`{ previous, next }`, each `[]` when absent): checkRelease loads each side with
them, as `loadRuleset` does, to resolve the standard copies queries. A side that doesn't load
fails the check with the load's errors, each with `data.release` (`previous` or `next`); an
engine must load the old release anyway to upgrade characters from it. The result lists the
shape changes and these errors:

- **`version-not-increased`:** the new version must be greater than the previous one.
- **`version-bump-too-small`:** a release with shape or interface changes needs a **breaking
  bump**: the minor version while the previous version is 0.x (0.1.4 → 0.2.0), the major version
  from 1.0.0 on (1.4.2 → 2.0.0). Going from 0.x to 1.0.0 or later is a breaking bump too. A
  release without them may bump any part.
- **`missing-upgrade-script`:** a release with shape changes must include a script with `from`
  equal to the previous version and `to` equal to the new one.
- **`upgrade-script-incomplete`:** each shape change must be covered by a step of that script, as
  in the table. `data` names the uncovered change. Interface changes need neither a script nor
  a step ([below](#a-packs-interface)).

A pack's release carries **all** its upgrade scripts, old ones included, so any pinned version
can be upgraded from the latest release.

## A pack's interface

Characters' homebrew ([characters.md](characters.md#homebrew)) is built on a pack's definitions,
so they are part of its public interface, like an API. There is no
`public` flag: every definition counts. Between two releases, these differences are **interface
changes**:

| Change                                                                        | `kind`                      | ID                      |
| ----------------------------------------------------------------------------- | --------------------------- | ----------------------- |
| A derived field is removed (homebrew formulas read derived fields)            | `field-removed`             | `<pack>:<field>`        |
| A content type is removed                                                     | `content-type-removed`      | `<pack>:<type>`         |
| An item field is removed from a remaining type, or its `type` or `of` changes | `item-field-removed`        | `<pack>:<type>/<field>` |
| An enum item field loses values                                               | `item-field-values-removed` | `<pack>:<type>/<field>` |
| A tag the pack's rules declare is no longer declared                          | `tag-removed`               | `<pack>:<tag>`          |
| A rules action is removed                                                     | `action-removed`            | `<pack>:<action>`       |

`checkRelease` lists them in `changes` after the shape changes, in this table's order, then by
ID. Each needs a breaking bump, but no upgrade script: no step can migrate a removed tag, and a
character's homebrew that uses one is reported by `upgrade`. A step that renames the thing
(`renameField`, `renameContentType`, `renameItemField`, `mapItemValues`, `renameTag`,
`renameAction`) migrates homebrew that uses it.

## Upgrade scripts

Upgrade scripts are **data, not code** ([`upgrade.schema.json`](../schemas/upgrade.schema.json)),
stored in `upgrades/<from>-to-<to>.yaml`. IDs in steps are local to the script's pack:

```yaml
pack: 5e-srd-5.1
from: 0.2.1
to: 0.3.0
steps:
  - { op: renameContent, from: feats.sharpshooter, to: feats.sharp-shooter }
  - { op: setDefault, field: hp.rolled, value: 'hp.max - abilities.con.mod * level.total' }
  - { op: requireChoice, owner: classes.fighter, choice: weapon-mastery }
```

The steps are a [fixed set](../data/upgrade-steps.json). A step applies to every place saved
state can refer to what it names:

| Op              | Params                                                                        | Effect                                                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renameContent` | `from`, `to`                                                                  | Replaces the content ID everywhere: entry `item`s, `templates`, `applied` sources, picked `option`s at any depth, members of `set` input values, and the owner part of prefixed choice keys                         |
| `removeContent` | `id`                                                                          | Removes entries holding it (with their picks), removes it from `templates`, `applied`, picks (with their nested picks) and `set` input values                                                                       |
| `renameField`   | `from`, `to`                                                                  | Moves the saved value                                                                                                                                                                                               |
| `removeField`   | `field`                                                                       | Drops the saved value                                                                                                                                                                                               |
| `setDefault`    | `field`, `value`                                                              | Where the field has no saved value, saves the formula's value. The formula is evaluated against the **original** character under the **old** ruleset                                                                |
| `mapValues`     | `field`, `map`                                                                | Replaces a saved value found as a key of `map` (compared as text) with the mapped value                                                                                                                             |
| `renameState`   | `item?`, `type?`, `from`, `to`                                                | Renames a state key in the saved state of copies, picks and granted content ([characters.md](characters.md#granted-contents-state)) of content `item` and of content type `type` (all of them when both are absent) |
| `removeState`   | `item?`, `type?`, `key`                                                       | Drops the state key from the same places as `renameState`; a pick's or grant's `state` left empty goes, and a grant entry with it                                                                                   |
| `moveState`     | `item?`, `type?`, `from`, `to?`, and `grant`, or `owner?`, `choice`, `option` | Moves state key `from` off copies of `item` and of content of `type` to key `to` (default `from`) of a pick or of granted content's saved state ([below](#moving-state))                                            |
| `renameChoice`  | `owner?`, `from`, `to`                                                        | Renames a choice key on entries holding `owner`, in picks of `owner`, and in prefixed keys (`<owner>/<choice>`). Without `owner`, renames a rules-level choice                                                      |
| `removeChoice`  | `owner?`, `choice`                                                            | Removes the choice's picks, with their nested picks, wherever `renameChoice` would rename it                                                                                                                        |
| `renameOption`  | `owner?`, `choice`, `from`, `to?`                                             | Replaces a picked option of the choice (`from`) with `to`; without `to`, removes the pick and its nested picks                                                                                                      |
| `requireChoice` | `owner?`, `choice`                                                            | Records that a new required choice exists; the upgraded character reports it as pending                                                                                                                             |
| `renameTag`     | `from`, `to`                                                                  | Replaces the tag in saved `set` values of `of: tag` input fields (and in the homebrew, below)                                                                                                                       |
| `adoptStandard` | `item`                                                                        | Renames the first entry holding the item (features, then inventory, in file order) to the item's standard copy ID, keeping its state, picks and templates; nothing when an entry has that ID                        |

**Owners.** A choice step's `owner` is content (local or qualified), or the rules when absent.
A choice nested in an inline option is named by a path, as its change ID writes it: the owner,
then each choice and inline option down to the option that declares it, joined by `/`
(`owner: classes.operative/specialization/ghost`, `choice: skill-feat`). A path with an even
number of parts starts at a rules-level choice (`owner: motto/brave`). The step follows the
saved picks: the choice under the pick of `ghost`, wherever the operative's tree is saved.
Choice keys are as in [characters.md](characters.md#choices-tree): a slotted choice's slot is its
own key (`skill-feat-2`).

### Moving state

`moveState` is for state that a release moves off a copy to the content that now keeps it: a
pick's `state`, or granted content's saved state (`grants`) on the copy. For each copy of `item`
and of content of `type` (every copy when both are absent) with a saved `from`, the value leaves
the copy, and goes to:

- **with `grant`:** the saved state of that content, on the copy, when the copy holds it by a
  holder grant on the new release (its type's, item's or templates' grants, and theirs in turn;
  a grant whose `item` is a formula isn't followed);
- **with `choice` and `option`:** the pick of `option` (content local or qualified, else an
  inline option or value as written) in that choice of `owner`, in the copy's own choice tree at
  any depth; a rules-level choice (no `owner`) is the top-level `choices`. A slotted choice (on
  the new release) is searched slot by slot, so `choice` names it once.

The value is dropped, never reported, when:

- the target isn't there (no such pick on the copy, or no holder grant of the content);
- the target content doesn't declare key `to` on the new release;
- the target already has a saved `to`: it is newer, and wins;
- it equals the target's default: the declared default, unless a grant of that content sets the
  key in its `state`, whose value the saved one then overrides, so it is kept.

A dropped value counts as a change: the step is listed in the report. A copy's `state` left empty
goes. Where items of a type share a key that moves to different content (an elf's and a
tiefling's `lineageSpell1Used`, to each one's lineage trait), one step per item with `item`
moves each; the first step without it would drop the others'. For `state-removed`, a step with
`item` covers only that item's key.

`adoptStandard` is for a release that makes an item standard
([content.md](content.md#standard-copies)): entry IDs are the app's choice, so the script names
the item. `checkRelease` requires one per `standard-copy-added`.

Steps that change only a character's homebrew ([below](#a-characters-homebrew)):

| Op                  | Params                 | Effect                                                                                                                 |
| ------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `renameContentType` | `from`, `to`           | Rewrites content type references                                                                                       |
| `renameItemField`   | `type`, `from`, `to`   | On homebrew items of the type, moves the item field and rewrites `item.<from>` in their formulas                       |
| `removeItemField`   | `type`, `field`        | Drops the item field from homebrew items of the type                                                                   |
| `mapItemValues`     | `type`, `field`, `map` | On homebrew items of the type, replaces the item field's value found in `map` (compared as text; each member of a set) |
| `renameAction`      | `from`, `to`           | Rewrites action references                                                                                             |

## The `upgrade` call

`upgrade(from, to, character)`: `from` is the ruleset the character was saved with, `to` the
ruleset to move it to. See [`engine/upgrade.schema.json`](../schemas/engine/upgrade.schema.json).

1. **Every pinned pack must be in `to`** (`unknown-id`). Packs in `to` that the character doesn't
   pin are ignored.
2. **For each pinned pack, in pin order, find the chain.** Starting at the pinned version, repeat:
   - take the script in `to`'s release whose `from` equals the current version;
   - otherwise, the script with the smallest `from` above it and not above the target (the
     versions between changed no state);
   - apply it, and continue from its `to`.

   Stop when no script remains at or below the target. A target below the pinned version is
   `no-upgrade-path`.

3. **Apply each script's steps in order** to a copy of the character, then pin the new version.
4. **Report.** Compute the sheet under both versions: the original character with `from`, the
   upgraded one with `to`. Then fill in:
   - **`values`:** every field whose value differs, as `{ field, before, after }`, sorted by field
     ID. A field renamed by `renameField` is compared under its new ID. A field that exists on one
     side only has only `before` or `after`.
   - **`steps`:** each step that changed the character (its homebrew included), with the script
     it came from.
   - **`homebrew`:** each place in the homebrew a step rewrote, in order, as `{ path, step }`
     (`path` a JSON Pointer into the upgraded character).
   - **`errors`:** the upgraded character's `computeSheet` errors (a reference no script handled).
     For a character with homebrew, `homebrew-error` for each load error of the homebrew on `to`;
     the upgraded character is still returned, so the app can show the report and let the player
     fix the custom content.
5. **`pending`:** the upgraded character's pending choices, which include any `requireChoice`.

Upgrading is deterministic, and it never asks the player anything. New required choices come
back as pending for the app to put to the player.

## A character's homebrew

A character's homebrew is loaded on top of both rulesets: on `from`
before the steps (a homebrew that doesn't load there is `homebrew-error`, and nothing is
upgraded), and on `to` for the report. Each step rewrites the homebrew too, after saved state.

**Where a step looks.** The homebrew's `rules` and `content` (never `i18n`), by kind:

| Kind         | Places                                                                                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content      | `extends` and `item` values; members of `items` lists; item field values of `id` or `set` item fields whose `of` is a content type; string literals in formulas equal to the qualified ID (see below)    |
| Field        | `target`, `field` and `into` values; members of `fields` and `absorbedBy` lists; keys of `recommend` and of the rules' display `fields`; item field values of `of: field` item fields; names in formulas |
| Content type | `type` and `of` values; string literals in formulas equal to the qualified ID                                                                                                                            |
| Action       | `use` and `action` values                                                                                                                                                                                |
| Tag          | members of `tags` lists and of effect targets' `choices`; item field values of `of: tag` item fields; string literals in formulas equal to the tag                                                       |

- **Matching.** A reference matches a renamed `<pack>:<id>` when it is that qualified ID, or is
  `<id>` unqualified and the homebrew's scope doesn't resolve it to something else on `from`.
  The homebrew's own `gear.rope` is left alone when a pack renames its `gear.rope`. In a
  `source` formula (applyEffect's, an action step's), a string literal names content as
  written, so it matches as a reference does.
- **Writing.** A rewritten reference is written qualified (`mothership-1e:gear.cell`), so it
  keeps resolving whatever the homebrew defines. Names in formulas can't be qualified: a
  renamed field's name is its new local ID.
- **Formulas** are the homebrew's formulas written as text: parsed, renamed in the tree and
  written back as canonical text ([formulas.md](formulas.md#the-tree)).
- **Homebrew items of a type** are those whose content type (through `extends`) is the step's
  `type`, as renamed by earlier steps. `renameState` on saved copies of homebrew items finds
  their type the same way.

| Step                                                  | Rewrites in the homebrew                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `renameContent`                                       | content references                                                                                                  |
| `renameField`                                         | field references                                                                                                    |
| `renameState`                                         | the `state` declaration and `self.<from>` in formulas, on homebrew items of `type` (every homebrew item without it) |
| `renameContentType`                                   | content type references                                                                                             |
| `renameItemField`, `removeItemField`, `mapItemValues` | as in the table above                                                                                               |
| `renameTag`                                           | tag references                                                                                                      |
| `renameAction`                                        | action references                                                                                                   |
| Others                                                | nothing: homebrew that still names removed content or fields is reported                                            |

After the steps, the homebrew is loaded on `to`; its load errors are in `report.errors`
(`homebrew-error`), and the upgraded character is still returned, so the app can show the
report and the player can fix the custom content with `setHomebrew`.
