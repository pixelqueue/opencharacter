# Packs

A **pack** is a versioned bundle of rules and/or content: a game edition, a sourcebook, a homebrew collection. Packs are plain files. Nothing in a pack is code.

## Layout

In this repository, packs are grouped by game: `packs/<game>/<pack>/`. A game folder holds
every pack for that game: its editions (`5e/srd-5.1`, later `srd/srd-5.2`) and any content-only
or homebrew packs. A pack's ID is `<game>-<pack>` (`5e-srd-5.1`, `mothership-1e`,
`fitd-scoundrel`), and the build rejects an ID that doesn't match its folders. Name pack
folders after their source (`srd-5.1`, `1e`), not `v1`/`v2`. The edition is part of the ID; the
pack's `version` counts data releases within it, starting at 0.1.0.

```
packs/<game>/<pack>/
  pack.yaml                    # manifest
  rules/*.yaml                 # rules documents (any number, merged)
  content/<dir>/<name>.yaml    # one content item per file
  i18n/<lang>.yaml             # player-facing text, one file per language
  i18n/<lang>/*.yaml           # or one language split over several files
  upgrades/<from>-to-<to>.yaml # upgrade scripts
```

- **Rules documents** ([`rules.schema.json`](../schemas/rules.schema.json)) hold fields, link slots, content types, settings, situational choices, result bands, shared actions, always-on effects, character-level choices, constraints and display hints. Every section is optional. A pack may split its rules over any number of files; the build merges them, and an ID defined twice is an error.
- **Content items** ([`content-item.schema.json`](../schemas/content-item.schema.json)): exactly one item per file. The item's `id` MUST match its path: `content/weapons/longsword.yaml` holds `weapons.longsword`, and `content/magic-items/weapon-plus-one.yaml` holds `magic-items.weapon-plus-one`. Each directory segment becomes one dotted ID segment.
- **Translations** ([`i18n.schema.json`](../schemas/i18n.schema.json)): see [i18n.md](i18n.md). Mechanics files contain no player-facing text.
- **Upgrade scripts** ([`upgrade.schema.json`](../schemas/upgrade.schema.json)): see [upgrades.md](upgrades.md).

The build step turns these files into one **pack release** ([`pack-release.schema.json`](../schemas/pack-release.schema.json)): `{ manifest, rules, content, upgrades?, i18n? }`, which is what `loadRuleset` takes. In this repo, `pnpm build:packs` validates every pack and writes its release; `pnpm validate` runs the same checks without writing anything.

## Manifest

`pack.yaml` ([`pack.schema.json`](../schemas/pack.schema.json)):

| Property          | Required       | Meaning                                                                                                                                                                                                                                           |
| ----------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | yes            | Pack ID: lowercase words joined by hyphens, dots allowed between them (`5e-srd-5.1`). Permanent. In this repository, `<game>-<pack folder>`.                                                                                                      |
| `version`         | yes            | Semver, starting at 0.1.0. Each update gets a unique version; published versions never change.                                                                                                                                                    |
| `specVersion`     | yes            | The **minimum** spec version the pack needs. `loadRuleset` refuses a pack that needs a newer spec (`spec-version-unsupported`). `pnpm release:check` refuses one lower than the features the pack uses ([versioning](versioning.md#3-each-pack)). |
| `license`         | yes            | SPDX identifier (`CC-BY-4.0`, `CC0-1.0`), `ORC`, `OGL-1.0a`, or `mechanics-only`.                                                                                                                                                                 |
| `credit`          | for CC-BY, ORC | The credit line (attribution) the license requires. Apps MUST pass it on to their users.                                                                                                                                                          |
| `notices`         | for ORC, OGL   | Other notices the license requires, by name (a slug → its text), in order. Apps MUST pass each on after `credit`.                                                                                                                                 |
| `defaultLanguage` | yes            | BCP 47 tag. The i18n file for it MUST exist.                                                                                                                                                                                                      |
| `dependencies`    | no             | Pack ID → semver range.                                                                                                                                                                                                                           |
| `hides`           | no             | Qualified IDs of dependency content to hide from the ruleset.                                                                                                                                                                                     |
| `homepage`        | no             | URL.                                                                                                                                                                                                                                              |

The pack's display name is the translation key `pack.name`.

`credit` and `notices` are legal text in the language the license requires, so they live in the
manifest, not in `i18n`. Apps show them verbatim and MAY label a notice by its name. A pack with
`license: ORC` MUST have `credit` (the attribution of the Licensed Material used, and how the pack
wishes to be credited) and the notices `orc` (the ORC Notice), `reserved-material` and
`expressly-designated` (the Expressly Designated Licensed Material notice, saying so when there is
none); other notices MAY follow. `loadRuleset` lists each pack's `credit` and `notices` in the
ruleset's `packs`, and a release keeps them in its manifest.

`OGL-1.0a` is the Open Game License v1.0a (Wizards of the Coast), which has no SPDX identifier.
The license asks for its own full text with the work (its section 10) and the copyright
notices of the Open Game Content used (sections 6 and 15), so a pack with `license: OGL-1.0a`
MUST have the notices `ogl-license` (the license's full text, verbatim) and `section-15` (the
COPYRIGHT NOTICE: the license's own line and each source's, exactly as the sources print them,
then the pack's own); it SHOULD name the Product Identity it mentions and say which parts are
Open Game Content (sections 7 and 8) in further notices.

`mechanics-only` means the pack carries mechanics and neutral labels only: no rules text, flavor
text or logos from the source game. Use it for games without an open license, or for a pack that
takes only mechanics and names from its source. Such a pack still carries what its source asks of
it: the `credit` of an open license whose material it uses (a CC-BY SRD's attribution), and the
`credit` and `notices` a third-party license it is published under requires (a copyright line, a
not-affiliated statement). Apps pass them on as for any license.

## IDs

- **Content IDs** are dot-separated segments of lowercase words joined by hyphens (`magic-items.flame-tongue`). They appear in formulas only as strings.
- **Field IDs** are dot-separated identifier segments with no hyphens (`abilities.str.mod`, `combat.critRange`). Formulas refer to fields by bare name, so a hyphen would read as subtraction.
- **Qualified IDs** add the pack: `5e-srd-5.1:weapons.longsword`, `5e-srd-5.1:abilities.str.score`.
- Inside a pack, a reference MAY be local (`weapons.longsword`). It resolves first in the referring pack, then in its dependencies in declaration order. A local reference that matches in more than one dependency is ambiguous and MUST be qualified.
- Character files always use qualified IDs ([characters.md](characters.md)).
- The pack ID `homebrew` is **reserved** for a character's own homebrew
  ([characters.md](characters.md#homebrew)); no pack may use it.
- IDs are **permanent and never reused**. Removed content is marked `deprecated` (with `since` and optionally `replacedBy`), and an upgrade script moves characters off it.

Bare field names in formulas resolve the same way as local content references: the formula's own pack first, then its dependencies. This resolution order is provisional.

## Dependencies and load order

- A pack declares the packs it builds on in `dependencies`. `loadRuleset` fails with `missing-dependency` when one is missing or outside its range.
- The **app** chooses the load order, and every dependency MUST load before the packs that depend on it. **Later packs win.**
- When two packs override the same property of the same thing, the later one wins and the ruleset reports the conflict in `conflicts`, so nothing is overridden silently.
- **Content order** is the load order, then each pack's content in its release's order (the
  build writes it in file path order); a character's homebrew comes last. Every list of content
  the engine gives follows it: the ruleset's `content`, query matches, a choice's or a choice
  step's content options and random draws over them. So a dependency's content leads, and an
  automatic run that takes the first option (`recommend: options[0]`) takes the core pack's,
  whatever an add-on pack is called.

## Overrides, hiding and `extends`

- **Override:** a content file with `override: <qualified id>` instead of `id`/`type` changes only the properties it mentions ("Longsword damage is 1d10"). Arrays (effects, tags, choices) are replaced as a whole. **PROVISIONAL**: finer-grained array patching is undecided.
- **Extensions:** a pack adds to its dependencies without overriding them, so add-ons don't
  collide: values to an open enum (`extendEnums`, [rules-and-fields.md](rules-and-fields.md#open-enums)),
  options to a choice (`extendChoices`, [content.md](content.md#adding-options-to-a-dependencys-choices)),
  and, from its rules' `option` and `changes` effects, options and changes to tagged action steps
  ([effects.md](effects.md#targets)). Additions merge in load order and are applied after
  overrides.
- **Hide:** `hides` in the manifest removes dependency content from the ruleset. Queries no longer match it. A character that owns hidden content gets a rules issue (`content-hidden`), not an error.
- **Extends:** `extends: <ref>` makes a permanent variant. The item inherits everything from its parent and then applies its own properties, with the same replacement rules as overrides. `extends` chains MUST NOT loop (`circular-extends`) and are limited by the `maxExtendsDepth` safety limit. Overrides, `extends` and `hides` work on content items only. A new edition of a game is its own pack and doesn't depend on the earlier one; a content pack depends on the one edition it was built for.
- **Templates** are different: they are applied to a character's copy during play ([content.md](content.md#templates)).

## Releases

`pnpm build:packs` validates every pack and then builds each into its release (refusing invalid
packs):

- **`dist/release.json`:** the [pack release](../schemas/pack-release.schema.json):
  - the manifest, the merged rules document, the content and every upgrade script;
  - a **`formulas`** table mapping each formula's source text to `{ text, tree }` (its canonical
    text and parsed tree).

  Formulas elsewhere stay as written. A port can parse them or look up their trees.
  `loadRuleset` refuses a release whose compiled tree doesn't match its text.

- **`dist/index.js`:** the same release as a JavaScript module, the package's main entry point
  (`import pack from '@opencharacter/5e-srd-5.1'`).
- **`dist/i18n/<default language>.{json,js}`:** the default language, an opt-in entry point
  (`import en from '@opencharacter/5e-srd-5.1/i18n/en'`).
- **Other languages** go in the pack's `-i18n` package (`<pack>/i18n-package/`, published as
  `@opencharacter/<id>-i18n`). It has its own version, so translation fixes never bump the pack.
  The build refuses a pack that has other languages but no `-i18n` package.
- **`@opencharacter/packs`** re-exports every official pack's release by pack ID,
  and each pack's default-language text by pack ID
  (`import en from '@opencharacter/packs/i18n/en'`).
- **The spec's standard text**: the same build writes each language of the spec's
  `i18n/<lang>.yaml` (error, rules-issue, comparison and dice text, [i18n.md](i18n.md#engine-output))
  to `packages/spec/dist/i18n/<lang>.{json,js,d.ts}`, the entry point
  `@opencharacter/spec/i18n/<lang>` (`import text from '@opencharacter/spec/i18n/en'`).

Build output (`dist/`) is never committed.

## Validation checks

Besides schema validation, a conforming pack:

- has a matching `id` for every content file path, and no duplicate IDs across the merged rules;
- resolves every reference: content types, `extends`, grants, choice item lists, query types, action `use`, result-band sets, display-hint fields and groups, effect target fields;
- gives every content item's fields values of their declared types, with no undeclared fields and no missing required ones;
- adds only to its dependencies' open enums and existing choices, each addition of the choice's
  kind, and checks its content against the enums as its dependencies and its own additions
  leave them;
- has a default-language i18n file containing every required key ([i18n.md](i18n.md));
- has a `credit` line when the license is CC-BY;
- has a `credit` line and the notices `orc`, `reserved-material` and `expressly-designated` when the
  license is `ORC`.
- has the notices `ogl-license` and `section-15` when the license is `OGL-1.0a`.
