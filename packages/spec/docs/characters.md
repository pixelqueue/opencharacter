# Characters

A **character file** ([`character.schema.json`](../schemas/character.schema.json)) is the one strict, standard file for exchanging a character between apps. Apps MUST be able to import and export it, and it is what the engine reads. How an app stores characters internally is up to the app.

Monsters and NPCs use the same format. A stat block is a ready-made character with mostly fixed values, and damage to a goblin is `applyChanges` on the goblin.

## Only base state

A character file holds only what everything else is calculated from:

- input field values,
- owned content and per-copy state,
- picks,
- which temporary effects are on,
- which moments the rules called for are still owed (ephemeral follow-ups): an
  event, unlike a value, can't be derived again from the rest.

Derived values are **never** saved, so a character can never disagree with the rules.

## Structure

```yaml
specVersion: 0.2.0
id: 7f1c... # unique within the app or campaign, or a URL to make it global
packs: # exact versions, in load order
  - { id: 5e-srd-5.1, version: 0.2.0 }
creating: false # true while the character is being created (the default is false)
values: # input fields, qualified IDs
  5e-srd-5.1:abilities.str.base: 16
features: # owned content that isn't carried
  - id: f-fighter
    item: 5e-srd-5.1:classes.fighter
    state: { level: 3 }
    choices:
      fighting-style:
        - option: 5e-srd-5.1:fighting-styles.dueling
inventory: # carried content
  - id: inv-1
    item: 5e-srd-5.1:weapons.longsword
    templates: [5e-srd-5.1:magic-items.weapon-plus-one]
    equipped: true
applied: # temporary effects from content not owned
  - { id: a-bless, source: 5e-srd-5.1:spells.bless, active: true }
followUps: # ephemeral follow-ups the engine stored, until acted on or dismissed
  - id: concentration-1
    followUp: 5e-srd-5.1:concentration
    params: { damage: 12 }
    cause:
      {
        field: 5e-srd-5.1:hp.current,
        by: -12,
        requested: -12,
        taken: -12,
        reason: requested,
        clamped: false,
        tags: [damage],
      }
choices: {} # character-level (rules) choices
links: # who fills each link slot (another character's id)
  fitd-scoundrel:crew: example-fitd-crew-ravens
homebrew: {} # the character's own content and rules additions (see Homebrew)
extensions:
  com.example.vtt: { portrait: '...' }
```

| Property      | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `specVersion` | The spec version the file was written against. `upgrade` moves it to the engine's, running any spec upgrades between ([versioning.md](versioning.md#character-files))                                                                                                                                                                                                                                                                                                                                                  |
| `id`          | Character ID, up to 2048 characters. A UUID is fine for an ID unique within the app or campaign; a URL (IRI, `https://example.com/characters/tamsin`) makes it global, so the character keeps one identity across apps and other files can link to it by that URL                                                                                                                                                                                                                                                      |
| `packs`       | Pinned exact pack versions, in load order. The app decides when, or whether, to upgrade ([upgrades.md](upgrades.md)).                                                                                                                                                                                                                                                                                                                                                                                                  |
| `creating`    | Whether the character is being created. Default false: see [Creating a character](#creating-a-character)                                                                                                                                                                                                                                                                                                                                                                                                               |
| `values`      | Input field values by **qualified** field ID. Missing fields take their default. A value for a derived field is a runtime error (`not-input-field`).                                                                                                                                                                                                                                                                                                                                                                   |
| `features`    | Entries for content whose type is not `carried`: classes (with `level` state), feats, traits                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `inventory`   | Entries for `carried` content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `applied`     | Temporary effects from content the character doesn't own (Bless cast by an ally, a condition). The app turns them on and off; the engine never tracks time. An entry the character is immune to is blocked: it stays, has no effect and is reported as `immune` ([content.md](content.md#when-content-is-active)).                                                                                                                                                                                                     |
| `followUps`   | Ephemeral follow-ups: what the rules called for when a batch fired an `on` or `becomes` follow-up or an action offered one (`offerFollowUp`), stored by that applyChanges as `{ id, followUp, source?, to?, character?, params?, cause? }` until it is acted on (`clearFollowUp`) or dismissed (`dismissFollowUp`); a `becomes` one also lapses, deleted by the next applyChanges, once its condition is false. The engine writes them; derived offers are never stored ([engine-core.md](engine-core.md#follow-ups)). |
| `choices`     | Picks for rules-level choices                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `links`       | Which character fills each link slot, by qualified slot ID: that character's `id` ([rules-and-fields.md](rules-and-fields.md#link-slots)). A slot no pinned pack declares is a runtime error (`unknown-link`).                                                                                                                                                                                                                                                                                                         |
| `homebrew`    | The character's own content and rules additions, loaded as the pack `homebrew`: see [Homebrew](#homebrew)                                                                                                                                                                                                                                                                                                                                                                                                              |
| `extensions`  | App extras                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Every content and field reference in a character file is **fully qualified** (`pack:id`).
The character's own homebrew is qualified with the reserved pack ID `homebrew`.

## Entries

An entry ([`character.schema.json#/$defs/entry`](../schemas/character.schema.json)) is the character's copy of an item: a base plus templates.

- `id`: unique within the file. Changes refer to copies by this ID.
- `item`: the base content item.
- `templates`: applied in order. Each MUST match the template's `appliesTo`.
- `equipped`: only for `equippable` types.
- `quantity`: an integer ≥ 0, default 1. `setQuantity` and `adjustQuantity` change it; a copy
  at 0 stays until removed.
- `state`: values for keys declared by the content type, the item, or its templates.
- `choices`: picks for choices declared by the item and its templates.
- `grants`: saved state of content the item and its templates grant
  ([below](#granted-contents-state)).

**Standard copies**. Copies every character holds
([content.md](content.md#standard-copies)) aren't listed while they're at their defaults: not
equipped, quantity 1, no templates, picks or granted content's state, and no state other than
the defaults.

- An entry whose `id` is a standard copy's derived ID and whose `item` is that item **is** the
  standard copy, saved with its changes, and keeps its place in the file. With another `item` it
  is the runtime error `duplicate-id`, and the entry is skipped.
- Any other entry for a standard item is an ordinary extra copy (a second lantern).
- An entry whose item stops being standard (the ability that holds it is unpicked, or a pack
  update drops the tag) stays as an ordinary entry with its state.
- `applyChanges` writes an unsaved standard copy before changing it, and removes a saved one
  that is back at its defaults, so files stay minimal.

```yaml
# The table tags its own lantern and armor `standard`, so every scoundrel holds them. This one
# carries both on this score; the ritual its Ritual ability starts with is a standard copy at its
# defaults, so the file leaves it out.
inventory:
  - id: homebrew-gear-lantern
    item: homebrew:gear.lantern
    equipped: true
  - { id: homebrew-gear-armor, item: homebrew:gear.armor, equipped: true }
```

An applied entry has an `id` unique within the file too, its `source` (a content item, not a
template), `active` (default true) and `state`: values for keys declared by the source's content
type or item. An action may apply one without choosing its `id`: applyChanges gives it
`<source local id, dots as hyphens>-<n>` (`conditions-blinded-1`). Changes reach
an applied entry by its ID, or by query (`applied: { where }`), and `setState` and
`adjustState` change its state as a copy's.

## Choices tree

Picks are stored as a tree keyed by choice ID. Each pick has an `option`, which is a qualified content ID, an inline option ID, or a value. A pick may have nested `choices` for the choices that option contains:

```yaml
choices:
  martial-archetype:
    - option: 5e-srd-5.1:subclasses.champion
      choices:
        additional-fighting-style: []
```

A pick may also keep `state`, for state keys its picked content declares: a
once-a-day feat's `used`, as a copy's state would. A key at its default is left out. It may keep
`grants`, the saved state of content its option grants ([below](#granted-contents-state)).

Choices declared on an item are stored on that item's entry. Choices declared in the rules are stored in the top-level `choices`. Picked content is never also listed in `features`.

Keys in a `choices` tree are bare choice IDs for the tree's own item (the entry's item, or the
picked option). Choices declared by templates or granted content in the same tree use
`<qualified owner id>/<choice id>`, such as `5e-srd-5.1:magic-items.some-template/damage-type`.

## Granted content's state

Content a holder grant makes active keeps its own state where its picks are kept: an entry, or
a pick, holds `grants`, the saved state of the content its item (with its templates) or picked
option grants, by the granted content's qualified ID. Each holds `state`, as a pick does, for
keys the granted content declares; a key at its default (the grant's `state` value, else the
declared default) is left out ([content.md](content.md#when-content-is-active)). It changes
through `setState` and `adjustState` with `grant`, and through the granted content's own
incoming-change `then` ([effects.md](effects.md)).

```yaml
inventory:
  - id: blade
    item: my-pack:artifacts.sun-blade
    equipped: true
    grants:
      my-pack:gifts.flame-ward: { state: { committed: 1 } }
```

## Creating a character

A pack offers ways to start a character in its rules' `creation` list
([rules-and-fields.md](rules-and-fields.md#creation)). Whatever the way, an app:

1. makes a character file with the packs and `creating: true`;
2. either runs a start's action and applies its proposed changes (random or guided), or lets
   the player fill in the blank sheet (manual);
3. finishes with the change `finishCreation`, which clears `creating`. A creation action proposes
   it as its last change, so applying the action's changes is the player's confirmation.

`finishCreation` is rejected (`creation-incomplete`) while the character has rules issues or
pending choices; the failed result lists them as `issues`, pending choices as `too-few-picks`.
An app can then apply the other changes on their own and let the player resolve what's listed.
Constraints that hold only at creation guard on `character.creating`
(`'!character.creating || ratings.highest <= 2'`), so they stop applying once the character is
finished.

A character with every field at its default loads and computes without engine errors; what it
lacks shows as rules issues and pending choices.

**A linked character**: an offer with `create` (a MÖRK BORG companion's sheet)
asks for a new character for one of this character's empty link slots. The app makes the file
with `creating: true` and the offer's `pack`, runs the named start with the offer's `params` as
above, and saves the new character's `id` in this character's `links` under the slot, which ends
the offer ([engine-core.md](engine-core.md#the-offer-list)).

## Homebrew

A character may carry its own content and rules additions in `homebrew`
([`homebrew.schema.json`](../schemas/homebrew.schema.json)): a custom
weapon, a custom skill or feat, a table's own special ability. It is a small pack that belongs
to the character, so the character file stays self-contained when it is shared.

```yaml
specVersion: 0.2.0
id: example-mothership-reyes
packs:
  - { id: mothership-1e, version: 0.1.1 }
homebrew:
  defaultLanguage: en
  rules: # optional: a rules document, without settings
    tags: [energy]
  content:
    - id: gear.blaster
      type: weapon # resolves to mothership-1e:weapon
      tags: [ranged, energy]
      fields: { damage: 2d10, magazine: 12, range: long, woundType: fire }
  i18n:
    en:
      gear.blaster.name: Blaster
inventory:
  - { id: inv-1, item: homebrew:gear.blaster, equipped: true }
```

- **A pack named `homebrew`.** Engines load the section as a last pack with the reserved ID
  `homebrew` ([packs.md](packs.md#ids)), so its definitions are `homebrew:<id>` everywhere else
  in the file. Every character's homebrew uses the same prefix; it is only ever loaded with its
  own character.
- **Scope.** The homebrew depends on every pinned pack, in pin order. A reference resolves in
  the homebrew first, then in each pinned pack and its dependencies, in pin order. So `weapon`
  above is `mothership-1e:weapon`, and the blaster has that type's state, effects and `shoot`
  action. Content-only queries see homebrew items, so a homebrew skill joins a class's skill
  picks, and prerequisites can name it (`@skills.xenoarchaeology in skills.known`, an [ID literal](formulas.md#id-literals) resolving to `homebrew:skills.xenoarchaeology`).
- **What it may define:** content items (each with `id` and `type`) and any rules-level
  definition a rules document has: fields, content types, tags, situational choices, result
  bands, actions, effects, follow-ups, rules-level choices, constraints, display hints.
- **What it may not do:** override or hide pinned packs' content, or change settings
  (`homebrew-not-allowed`). A table rule that changes the official rules ("longswords do 1d10")
  belongs in a standalone pack that every player at the table loads.
- **Text** lives in `homebrew.i18n`, keyed as in a pack's i18n files. `defaultLanguage` is
  required with `i18n`. Engines never read it.
- **No license.** A character's homebrew is the player's own data, like the rest of the file.
- **Size.** The safety limits `maxHomebrewItems` (content items and rules-level definitions) and
  `maxHomebrewFormulas` (formulas written as text) bound it, since a shared character file is
  untrusted ([safety limits](../data/safety-limits.json)).
- **Loading** is the engine's: every call that takes a character loads its homebrew on top of
  the ruleset, and a homebrew that doesn't load is `homebrew-error`
  ([engine-core.md](engine-core.md#a-characters-homebrew)).
- **Editing** is the change `setHomebrew`, which replaces the section (`null` removes it). It is
  rejected while the rest of the file still uses homebrew content it removes, so deleting a
  custom item in use takes a batch that removes its uses first
  ([engine-core.md](engine-core.md#applychanges)).
- **Upgrades** rewrite the homebrew along with saved state: a renamed field, content ID, content
  type, item field, tag or action is renamed in it too, and what can't be migrated is reported
  ([upgrades.md](upgrades.md#a-characters-homebrew)).
- **Sharing a custom item between characters** means moving it to a standalone pack. That is
  app work: add the item to the pack, then rename `homebrew:<id>` to the pack's qualified ID in
  each character (as `renameContent` does with qualified IDs), and drop it from the homebrew.

## Extensions

`extensions` holds app-specific extras (portrait, notes, token settings), each under the app's own namespace: reverse DNS (`com.example.vtt`) or an npm package name (`@example/vtt`). Apps MUST carry other apps' extensions along untouched on import and export. The engine ignores them except for the `setExtension` change.

A namespace's value may be any JSON value. When it is an object, it may carry `$schema`: the URI of a JSON Schema that the extending app publishes for its data. Another app can then validate the data, render it as a form from the schema's titles and descriptions, or edit it safely. OCF doesn't host, fetch or check these schemas; whether to use one is each app's choice. `$schema` is carried along with the rest of the value.

```yaml
extensions:
  com.example.vtt:
    $schema: https://example.com/ocf/vtt-extension/1.json
    portrait: https://example.com/portraits/tamsin.png
    tokenSize: 2
```

## Exports

An **export** ([`export.schema.json`](../schemas/export.schema.json)) moves characters to another
app, which may not have every pack they pin: one character, a roster, or linked characters (a crew
and its scoundrels, a companion) in one file. It carries only data: no engine, since any
conforming engine runs any pack, and no sheet, which is derived.

```yaml
specVersion: 0.2.0
characters: # one or more character files, extensions and homebrew included
  - { specVersion: 0.2.0, id: https://example.com/characters/vex, packs: [...], ... }
  - { specVersion: 0.2.0, id: https://example.com/characters/the-ravens, ... } # linked
packs: # every pack version a character pins, once each
  # By reference: the receiving app supplies it. `url` and `integrity` are optional.
  - id: fitd-scoundrel
    version: 0.2.0
    url: https://example.com/packs/fitd-scoundrel.json
    integrity: sha256-…
  - release: { manifest: { ... }, rules: { ... }, content: [...] } # embedded
    integrity: sha256-…
extensions: {} # app extras, as in a character file
```

- **Packs** are listed once per ID and version, by **reference** (`id`, `version`, optionally
  `url` and `integrity`) or **embedded** (`release`, a [pack release](../schemas/pack-release.schema.json),
  what `loadRuleset` takes). Every version a character pins MUST be listed; a pack no character
  pins SHOULD NOT be. A file may mix the two: an export references every pack, a **bundle** embeds
  every pack so it opens anywhere with nothing else, and a file can embed only the packs the
  receiver is unlikely to have (third-party ones).
- **Characters** are whole character files. Their `id`s are unique within the export, and a
  character's `links` may name another character in the file.
- **Integrity** is `sha256-` and the base64 SHA-256 of the release's canonical JSON
  ([RFC 8785](https://www.rfc-editor.org/rfc/rfc8785): keys sorted, no whitespace), so it doesn't
  depend on how the release was written out.
- **Which copy is used.** For each listed pack, the receiving app may use its own copy of that ID
  and version, unless the entry has `integrity` and the copy doesn't match it. Otherwise it uses
  the embedded release, or fetches `url` and checks it against `integrity`. A pack it can't get
  leaves the characters that pin it unloadable; the app says which.
- **Spec version.** The export's `specVersion` is the version it was written against, as a
  character file's is. Each character keeps its own, and an app brings an older one up to date
  with `upgrade` ([versioning.md](versioning.md#character-files)).

The reference engine has helpers outside conformance: `createExport(characters, releases,
{ embed?, url? })` builds one with every pinned version and its integrity, `readExport(file,
available)` returns the releases to load (the app's matching copies, else the embedded ones) and
the packs still `missing`, and `releaseIntegrity(release)` hashes a release.

## Legality

Legality is checked against the current character only, never its history. A character with rules issues is still a valid file. Runtime errors are the things that would make a file invalid (unknown IDs, wrong types, out-of-range inputs, templates that don't apply), and the engine never produces such a file.
