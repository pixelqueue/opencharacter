# Storing characters

The **character file** is the one standard format for a character. Apps must be able to import
and export it, and it's what the engine reads. How you store characters inside your app is up to
you; this page covers what has to survive the trip.

## What's in a character file

```yaml
specVersion: 0.1.0
id: 7d1c2f4e-5b0a-4c39-9a51-2f7e8a6b3c10
packs: # exact pack versions, in load order
  - { id: 5e-srd-5.1, version: 0.1.0 }
values: # input fields, by qualified field ID
  5e-srd-5.1:abilities.str.base: 16
  5e-srd-5.1:hp.current: 37
features: # owned content that isn't carried: classes, traits, feats
  - id: fighter
    item: 5e-srd-5.1:classes.fighter
    state: { level: 3, startingClass: true }
    choices:
      fighting-style: [{ option: 5e-srd-5.1:fighting-styles.dueling }]
inventory: # carried content
  - id: inv-1
    item: 5e-srd-5.1:weapons.longsword
    templates: [5e-srd-5.1:magic-items.weapon-plus-one]
    equipped: true
applied: # temporary effects from content the character doesn't own
  - { id: bless-1, source: 5e-srd-5.1:spells.bless, active: true }
choices: {} # picks for rules-level choices
homebrew: {} # the player's own content, if any (below)
extensions: # your app's own data
  com.example.vtt: { portrait: tamsin.png }
```

The full shape is [character.schema.json](../../../packages/spec/schemas/character.schema.json),
explained in [Characters](../../../packages/spec/docs/characters.md).

**It holds only base state:** the values a player typed in, what the character owns, per-copy
state (charges, a class's level), picks (with their own state, such as a once-a-day feat's use),
the state of content a copy or pick grants (`grants`, below) and active temporary effects. Armor Class, modifiers,
attack bonuses and maximum HP are **never** in the file. They come from `computeSheet` every
time, so a saved character can't disagree with the rules, and a pack fix reaches every character
without migrating anything.

Content an item grants can keep state of its own: an artifact's gift whose Effort stays
committed. It is saved on the copy (or the pick) that grants it, under `grants`, by the granted
content's qualified ID, and left out while at its defaults:

```yaml
inventory:
  - id: blade
    item: my-pack:artifacts.sun-blade
    equipped: true
    grants:
      my-pack:gifts.flame-ward: { state: { committed: 1 } }
```

It stays while the grant is off (the blade stowed), so round-trip it like picks.

> Don't add derived values to the file "for convenience". If you need them without computing
> (a search index, a token's HP bar on a server), keep them in your own cache next to the file
> ([below](#caching-derived-values)).

## IDs

There are two kinds of ID in a character file:

- **Content and field IDs** (`5e-srd-5.1:weapons.longsword`) come from packs. They're always
  qualified with the pack, and permanent.
- **Instance IDs** are yours: the character's `id`, and the `id` of each entry in `features`,
  `inventory` and `applied`. Changes refer to copies by instance ID (`equip inv-1`). They must be
  unique within the file; the character's `id` should be unique within your app or campaign. A
  UUID is fine for that. To give a character one identity across apps, use a URL (IRI) you
  control, such as `https://example.com/characters/tamsin`: it's global, and other characters'
  `links` can name it the same way. A character ID may be up to 2048 characters. For entries, anything readable and stable works
  (`fighter`, `inv-1`, a UUID). A standard copy, which every character holds (the ritual FitD's
  Ritual ability starts with), has an ID the engine derives from its item
  (`fitd-scoundrel-rituals-ritual`); the
  file lists it only once it differs from its defaults.

Two longswords are two entries with the same `item` and different `id`s. An entry's `id` never
changes, so your app can hang its own data on it (a sort order, a note) in `extensions`.

## Your own data: `extensions`

Portraits, notes, token settings, sort orders and anything else that isn't game state go in
`extensions`, under your app's namespace: reverse DNS (`com.example.vtt`) or an npm package name
(`@example/vtt`).

```ts
applyChanges(ruleset, character, [
  { type: 'setExtension', namespace: 'com.example.vtt', value: { portrait: 'tamsin.png' } },
]);
```

- **Carry other apps' extensions along untouched.** A character exported from another app may
  have its data in there, and it must survive import into yours and export back out.
- The engine ignores extensions, except to store them with `setExtension`. `value: null`
  removes your namespace.
- `setExtension` replaces your namespace's whole value, so merge before you write.
- **Publish a schema for your data** if other apps should understand it: put its URI in
  `$schema` in your namespace's object (`$schema: https://example.com/ocf/vtt-extension/1.json`).
  Other apps can then validate it, show it as a form or edit it safely. OCF never fetches it.

Changing extensions through `applyChanges` isn't required (it's not game state), but it keeps
them in your change log with everything else.

## Custom content: `homebrew`

A player's own weapon, skill or ability goes in the character's `homebrew` section, not in a
pack your app has to create and ship. The section is a small pack inside the file, so the
character stays self-contained when it moves to another app or to the GM:

```yaml
packs:
  - { id: mothership-1e, version: 0.1.0 }
homebrew:
  defaultLanguage: en
  content:
    - id: gear.blaster
      type: weapon # the pinned pack's weapon type: shots and the shoot action come with it
      fields: { damage: 2d10, magazine: 12, range: long, woundType: fire }
  i18n:
    en:
      gear.blaster.name: Blaster
inventory:
  - { id: inv-1, item: homebrew:gear.blaster, equipped: true }
```

- **Refer to it as `homebrew:<id>`** everywhere else in the file. Inside the section, references
  resolve in the homebrew first, then in the pinned packs, so `type: weapon` is enough.
- **Nothing else changes.** Pass the same ruleset to every call; the engine loads the
  character's homebrew on top of it (and may cache that). A homebrew skill joins the class's
  skill picks, and prerequisites can name it.
- **It can add, not change.** Homebrew can't override or hide the packs' content or change
  settings. A table rule that changes the official rules belongs in a standalone pack that the
  whole table loads ([packs and rulesets](packs-and-rulesets.md)).
- **Errors.** If the homebrew doesn't load (a typo in a type, a formula naming a missing field),
  every call returns `homebrew-error`, with the load error as `data.cause` and a `path` into the
  file (`/homebrew/content/0`). Show it so the player can fix the item. Its size is capped by
  the safety limits `maxHomebrewItems` and `maxHomebrewFormulas`.
- **Editing it** is the change `setHomebrew`, which replaces the section (`null` removes it). It
  is refused while the file still uses an item it removes, so remove the item's copies and picks
  earlier in the same batch. A batch that starts with `setHomebrew` also repairs a homebrew that
  no longer loads.
- **Upgrades** rewrite the homebrew along with the saved state: a field, item, content type, item
  field, state key, tag or action the pack renames is renamed in it too, each place listed in the report's
  `homebrew`. What can't be migrated is in the report's `errors`, for the player to fix.
- **A custom-item form** builds its inputs from the content type's `fields`
  (`ruleset.contentTypes[type].fields`): the declaration gives each input's kind (`dice`,
  `integer`, `enum` with its `values`, `id` or `set` with `of`), `required`, `default`, `min`
  and `max`, and the pack's text its label, hint and value names (`text.typeField`,
  `text.typeFieldDescription`, `text.value`; [showing text](showing-text.md)). Ask for every
  field: they are all the item author's, and what changes in play is the copy's `state`, set on
  the sheet after `addItem`. A field's display hint `hidden` keeps it off the item's card, not
  out of the form; fold hidden and optional fields under "more" if you like. Save with one
  batch: `setHomebrew` with the new item and its name in `i18n`, then `addItem`.
- **Sharing an item between characters** means moving it into a pack of its own: add it there,
  rename `homebrew:<id>` to the pack's ID in each character, and remove it from the homebrew.

`pnpm validate` checks the homebrew in the example characters as it checks a pack:
[`mothership-reyes.yaml`](../../../examples/characters/mothership-reyes.yaml) (a blaster and two
custom skills) and [`fitd-ash.yaml`](../../../examples/characters/fitd-ash.yaml) (a homebrew
special ability).

## Storing it in your app

Anything that round-trips the file is fine:

- **A document store or a JSON column:** store the file as is. Simplest, and import and export
  are free.
- **Your own tables:** fine, as long as you can rebuild the exact file for export, including
  other apps' extensions and every pick.
- **Files in git:** the format is designed for it. YAML and JSON are equivalent.

Whatever you choose, validate imported files against
[character.schema.json](../../../packages/spec/schemas/character.schema.json) (the schemas are
published with the spec package and at `schemas/0.1/` on this site). Then compute the sheet:
`computeSheet` never fails, and it lists anything in the file that doesn't resolve (an unknown
item, a value for a field that no longer exists) in `errors`, computing the rest.

## Change logs, undo and sync

`applyChanges` is a reducer: `(character, changes) → new character`. It never mutates its input,
and the same changes always give the same result. That gives you three patterns for free:

- **Undo:** keep the previous character. Undo is putting it back.
- **History:** store each batch of changes with who made it and when. Log `result.changes`, the
  batch as applied, not the one you sent: an `adjust` whose effects rolled dice comes back with
  the faces it used, and replaying it without them fails with `faces-required`. Replaying the
  batches from a starting file rebuilds the character exactly.
- **Multiplayer sync:** send change batches instead of whole characters. Every client applies
  them in the same order and gets the same character. Keep the server's copy authoritative and
  let it reject batches that fail.

A batch is all or nothing: a level-up of eight changes applies completely or not at all, so a
half-applied level-up can't end up in your log.

Changes are plain JSON ([change.schema.json](../../../packages/spec/schemas/change.schema.json)), so
a log is easy to store and send.

## Caching derived values

`computeSheet` computes the whole sheet each time. That's fast for one character, but some apps
need values for many characters at once: a VTT drawing thirty HP bars, a server answering "who's
below half HP", a list of characters with their levels.

The engine has no partial or incremental compute, so cache yourself:

- Compute the sheet when a character changes (after `applyChanges`) and keep the values you
  need next to the file, keyed by character `id`.
- Throw the cache away when the character, its pinned packs, or the engine version changes.
- Never write cached values into the character file.

## Monsters and NPCs

Monsters and NPCs are characters too: a stat block is a character file with mostly fixed values
and a few owned items ([`5e-goblin.yaml`](../../../examples/characters/5e-goblin.yaml), made by
the 5E pack's `monster` creation start). Store a
monster type once as a template file, and give each goblin in an encounter its own copy with its
own `id`, so damage to one isn't damage to all.

## Next

- [Showing a sheet](showing-a-sheet.md).
