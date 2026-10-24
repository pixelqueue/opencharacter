# Packs and rulesets

A **pack** is a versioned bundle of game data: an edition's rules, a sourcebook's content, a
homebrew collection. A **ruleset** is what the engine makes from one or more packs, and every
other engine call takes it. This page covers getting packs, loading them, and keeping rulesets
around.

## Getting packs

A pack's **release** is one JSON document: its manifest, merged rules, content, upgrade scripts
and compiled formulas ([pack-release.schema.json](../../../packages/spec/schemas/pack-release.schema.json)).
That document is all the engine needs. Text lives next to it, one file per language.

| Where                           | What you get                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------- |
| npm, `@opencharacter/<pack id>` | The release as the default export, the default language as `/i18n/<lang>`        |
| npm, `@opencharacter/<id>-i18n` | Every other language, one entry point each (`@opencharacter/5e-srd-5.1-i18n/de`) |
| npm, `@opencharacter/packs`     | Every official pack's release, by pack ID                                        |
| GitHub Releases and jsDelivr    | The same `release.json` and language files, for apps that don't use npm          |
| A homebrew author               | The same format, under the author's own npm scope or as a file                   |

Official and homebrew packs load the same way. To your app, a pack is a JSON document you
fetched from somewhere.

```ts
import srd from '@opencharacter/5e-srd-5.1'; // the release
import en from '@opencharacter/5e-srd-5.1/i18n/en'; // only if you show English
```

Language files are separate entry points so your bundle includes only the languages you import.
See [Text and translation](text-and-translation.md).

### Licenses and credit lines

Every pack declares a license. A CC-BY or ORC pack carries a credit line, and a pack whose license
asks for more than one notice lists the others by name in `notices`. The credit line and every
notice **must reach your users**, the notices after the credit line. All are in the ruleset:

```ts
for (const pack of ruleset.packs) {
  if (pack.credit) showInCreditsScreen(pack.id, pack.license, pack.credit);
  for (const [name, text] of Object.entries(pack.notices ?? {})) {
    showInCreditsScreen(pack.id, name, text);
  }
}
```

The 5E SRD pack is CC-BY-4.0, so an app that uses it must show its credit line somewhere its
users can find it (an About or Credits screen is the usual place). The orc-2e pack is under
the ORC License: its credit line is the attribution, and its notices are `orc`,
`reserved-material` and `expressly-designated`. `mechanics-only` packs carry
no rules text by design, but may still have a credit and notices: the FitD packs credit their
SRD (CC-BY), and the MÖRK BORG pack carries what its third-party license requires. Show them the
same way.

## Loading: `loadRuleset`

```ts
const loaded = loadRuleset([coreRules, sourcebook, homebrew]);
if (!loaded.ok) {
  // loaded.errors: [{ code, path, data }], e.g. missing-dependency, formula-error
} else {
  const { ruleset } = loaded;
}
```

`loadRuleset` takes pack releases **in load order** and:

- checks each pack's spec version against the engine (`spec-version-unsupported`), and that
  every dependency is loaded and in range (`missing-dependency`);
- merges the rules and content, keyed by qualified ID (`pack:id`), so packs never collide;
- applies `extends`, overrides and hides;
- resolves the queries that only look at content ("every martial weapon");
- parses and type-checks every formula, the same checks the pack's build ran.

Load errors are for whoever set up the game: a missing pack, a pack too new for your engine, a
broken homebrew formula. They carry an error `code` you can show with the spec's standard text
([Text and translation](text-and-translation.md#errors-and-issues)).

### Load order

**Your app decides the load order.** Every dependency has to come before the packs that depend
on it, and **later packs win** when two change the same thing. A sensible order:

1. the edition's core rules;
2. official content packs;
3. the table's homebrew, in the order the GM chose.

When two packs override the same property of the same item, or the same setting, the later one
wins and the ruleset lists it in `ruleset.conflicts`
(`{ target, property?, packs }`). Nothing is overridden silently, but nothing is rejected either.
Show conflicts to whoever chose the packs (a GM's campaign settings screen), not to players
mid-session.

### Add-on packs

An add-on pack depends on a core pack and adds to it: monsters, weapons, spells, classes of the
core's content types. Its manifest names the core in `dependencies`, and its content uses the
core's types by name (`type: weapon`), so the core's processes (creation, starting gear, attacks,
monster starts) offer it beside the core's own:

- **Content order.** The engine lists content in load order, then each pack's file order, so the
  core's content comes first in every option list and an automatic run's first pick stays the
  core's, whatever the add-on is called.
- **Open enums.** A core enum marked `open: true` (a weapon's damage type) takes values from
  the packs that depend on it. The add-on lists them in its rules' `extendEnums`, keyed by the
  enum's address, and names them in its own text under the enum's key:

  ```yaml
  # rules/weapons.yaml
  extendEnums:
    'orc-2e:types.weapon.fields.damageType': [sonic]
  # i18n/en.yaml
  types.weapon.fields.damageType.values.sonic.name: Sonic
  ```

  The same goes for a rules action's parameter (`'mothership-1e:actions.wound-roll.params.woundType'`,
  named `actions.wound-roll.params.woundType.values.<v>.name`) and a state key an item declares
  itself (`'fitd-crew:cohorts.gang.state.gangType'`). The ruleset's `enumOrigins` says which pack
  added each value; pass it to `createText` ([Showing text](showing-text.md)) so added values get
  their names.

- **Families.** A core family (`families: { gang: [...] }`) takes keys from the add-on
  (`families: { 'fitd-crew:gang': [wreckers] }`), with the fields the core's patterns name for
  them. A core step offering `keysOf('gang')` offers the add-on's keys; the add-on names them
  under the core action's key (`actions.create-crew.options.wreckers.name`), found through
  `ruleset.familyOrigins`, which `createText` takes too.

- **Choice options.** A core choice over listed items, written values or inline options (a
  class's subclass pick) takes options from the add-on's rules' `extendChoices`, after the core's
  own and other add-ons', without overriding the class, so two add-ons both count:

  ```yaml
  extendChoices:
    'orc-2e:classes.barbarian':
      instinct: { items: [instincts.sonic] }
  ```

  Added inline options and values are named in the add-on's text under the core's key; pass
  `ruleset.optionOrigins` to `createText` too.

- **Action steps.** The add-on's rules' `option` and `changes` effects reach the core's tagged
  choice and changes steps (an extra option in a creation step), its options named
  `rules.options.<id>.name`.

An add-on can't change what the core wrote out by ID: a fixed kit list, a random table over core
IDs, a choice over a query whose `where` lists IDs. Those are for the core pack to open up, with
tags, item fields or the extensions above.

## Which packs a character uses

A character file pins the **exact versions** of the packs it uses, in load order:

```yaml
packs:
  - { id: 5e-srd-5.1, version: 0.2.0 }
  - { id: my-table-homebrew, version: 2.3.0 }
```

Load exactly those releases, in that order, to compute the character. Two consequences:

- **Keep old versions.** A character pinned to `5e-srd-5.1` 0.1.0 needs that release, even
  after 0.1.1 is out. Store releases by `id@version` and keep any version a saved character
  still pins. Published versions never change, so a release you've fetched once is good forever.
- **Characters can need different rulesets.** Two characters at the same table may pin
  different versions until someone upgrades them. Key your ruleset cache by the character's
  `packs` list, not by game.

If the ruleset's versions don't match the character's pins, `computeSheet` still computes the
sheet and reports `pack-version-mismatch` in its `errors`. Treat that as a reason to offer an
[upgrade](upgrading-characters.md), not as a failure.

A campaign usually settles on one pack list, and new characters pin whatever versions the
campaign uses. That's an app decision; the format doesn't model campaigns.

## Caching rulesets

`loadRuleset` does real work (merging, resolving queries, type-checking every formula), and its
output is plain JSON. So:

- **Load once, call many times.** Keep the ruleset in memory for as long as the pack list is in
  use, and pass it to every call.
- **Cache by pack list.** A key like `5e-srd-5.1@0.1.0,my-table-homebrew@2.3.0` works.
- **Skip the checks the build ran.** The reference engine skips the formula checks of releases
  you name in `prechecked`. Name only releases from your own bundle (the official
  packages), never one a user gave you:

  ```ts
  import orc2e from '@opencharacter/orc-2e';
  const loaded = loadRuleset([orc2e, tableHomebrew], { prechecked: new Set([orc2e]) });
  ```

- **Serializing is fine, within one engine version.** You can store a ruleset or send it from a
  server to clients, as long as the same engine version reads it. The ruleset's shape beyond its
  top-level properties is PROVISIONAL and engine-specific, so after upgrading the engine, or in a
  different engine or port, rebuild it from the pack releases.

## Listing content

Some screens need content the character doesn't own yet: a class picker, a shop, a spell list.
Choices inside content come with their options ([Building characters](building-characters.md)),
but "which classes exist" isn't a choice; it's a catalog. Today your app reads it from the
ruleset:

```ts
const classes = Object.values(ruleset.content).filter(
  (item) => item.type === '5e-srd-5.1:class' && !item.hidden,
);
// item.qid is the qualified ID to put in an addItem change
```

- `ruleset.contentTypes` lists every content type by qualified name, with its declared fields.
- `ruleset.content` lists every item by qualified ID, in content order (packs in load order,
  then each pack's content in file order), after `extends` and overrides, with
  `type` (the qualified type name), `hidden` (hidden by a later pack: leave it out) and
  `deprecated` (still valid, but don't offer it for new characters).
- An item's `fields` are its raw values. Numbers and dice in them are formulas as written in the
  pack (usually plain literals like `1d8`).

The item shape inside the ruleset is PROVISIONAL, so code that reads it may need updating when
the engine changes. There is no engine call for catalogs yet.

## Next

- [Storing characters](storing-characters.md).
