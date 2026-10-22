# Versioning

There are three separate version numbers.

## 1. The spec

The spec covers formats, operations, dice modifiers and engine behavior. The current version is **0.1.0**, which is pre-1.0: anything may still change.

From 1.0:

- **Minor bump:** additions that old packs keep working with, such as a new effect operation, dice modifier, change type or error code.
- **Major bump:** a change to what something means. This should almost never happen.

The spec is its own package (`@opencharacter/spec`), so ports get it without touching TypeScript, and so engine releases never look like spec changes. Schema `$id`s carry the spec's major.minor (`/schemas/0.1/`).

## 2. Each engine

Each engine library (the TypeScript reference engine and community ports) has its own version and declares which spec versions it implements (for example, engine 2.4.1 implements spec 1.3). Each engine runs the spec's test suite as part of its own tests. The TypeScript engine re-exports the spec's schemas and types.

## 3. Each pack

- Every pack update gets a unique version. **Published versions never change**, because characters pin them.
- Each pack declares the **minimum** spec version it needs (`specVersion` in `pack.yaml`). `loadRuleset` compares it with the engine's `SPEC_VERSION` and refuses a pack that needs a newer spec (`spec-version-unsupported`). The reference engine's `IMPLEMENTS_SPEC` (the major.minor versions it implements) derives from `SPEC_VERSION` too.
- Pack versions are [semver](https://semver.org/) and follow its convention for 0.x. A **breaking bump** is a minor bump while the version is 0.x (0.1.4 → 0.2.0) and a major bump from 1.0.0 on (1.4.2 → 2.0.0); any smaller bump is non-breaking. A dependency range such as `^0.1.0` accepts only non-breaking bumps (`>=0.1.0 <0.2.0`).
- Pack versions follow the upgrade rule in [upgrades.md](upgrades.md): a version that changes the saved state's shape, or the pack's interface, gets a breaking bump; a shape change also ships an upgrade script.
- There is one package per pack. The reason is versioning, not size: each version must mean only "this pack changed". Translations for languages other than the default live in a separate `-i18n` package, so translation fixes never bump the mechanics pack.

## The release flow

1. **Describe the change:** `pnpm changeset`, picking the packages and bump types. While a
   package is 0.x, a breaking change is a `minor` changeset and anything else a `patch`; a
   `major` changeset takes it to 1.0.0.
2. **Version:** `pnpm version-packages` runs `changeset version`, then copies each pack's new
   `package.json` version into its `pack.yaml`, since that is the version characters pin. It
   also moves every pin of a bumped pack's old version to the new one (example characters, test
   cases, docs and code samples), since the engine reports a pin that doesn't match exactly
   (`pack-version-mismatch`). Pins of any other version, such as an upgrade test's, stay.
   A dependency range on a bumped pack (a homebrew's or test pack's `dependencies`, in test cases,
   characters and docs) that the new version no longer satisfies becomes its caret range
   (`^0.1.0` → `^0.2.0`); one it still satisfies stays. An official pack's own range is part of
   its release, so the sync only warns about it: that pack needs its own changeset.
   The spec version is always the `@opencharacter/spec` package version, so it then moves
   `SPEC_VERSION` (and with it `SCHEMA_BASE`), every `schemas/<major.minor>/` in schema `$id`s
   and links (schemas, docs, apps and tests), and the docs' statements of the current version
   (prose and the README badge). The `specVersion` of the example characters and of the docs'
   samples (Markdown) moves too, since they are samples of the current spec; other minimums and
   records stay (a pack's `specVersion`, a test case's, a character file's). Code samples can
   import `SPEC_VERSION` instead of a literal. The engine's `IMPLEMENTS_SPEC` follows
   `SPEC_VERSION`: the reference engine implements the spec it ships with. A test fails if
   `SPEC_VERSION` and the package version ever differ, or if a stated version, badge or sample
   names another.
3. **Check:** `pnpm release` runs every check, builds the packs, then runs `pnpm release:check`.
   For each pack it compares the new release with the last published one, found by git tag
   (`@opencharacter/<id>@<version>`):
   - a version that is already published must build to the same release
     (`published-version-changed` otherwise);
   - otherwise `checkRelease` against the latest lower version must pass: shape changes need a
     breaking bump and a covering upgrade script ([upgrades.md](upgrades.md#the-build-check)).

   Pending changesets count: a pack that a changeset bumps is checked as the version step 2 will
   give it (the Changesets release plan), so a pull request that changes a published pack passes
   once it adds a changeset, before the "Version Packages" pull request bumps it. Its upgrade
   script goes to that version, which `pnpm validate` allows; a script further ahead fails. A
   breaking change needs a breaking changeset (`minor` while 0.x). Once step 2 has run, the
   version is in `pack.yaml` and the changesets are gone, so nothing changes.

   The migration tests (`scripts/release/upgrades.test.ts`) run the upgrade scripts on old saved
   data. Each upgrade script ships with a fixture in `scripts/release/upgrade-fixtures/` holding
   a character of the old shape; the test upgrades it from the release tagged at the script's
   `from` to the one at its `to`, tagged or, before then, as built here at the pending version,
   and checks the result. It needs the git tags, so it skips in a clone without them; CI's build
   job runs it with them.

4. **Publish:** the release workflow (`.github/workflows/release.yml`) runs on every push to
   `main`. With pending changesets it opens a "Version Packages" pull request that runs step 2;
   with none it runs `pnpm release`, then `changeset publish`, which publishes every package
   whose version isn't on npm yet (with npm provenance) and tags it. Built output (`dist/`: the
   engine, text and spec modules, the packs' releases and text, the bundle) comes from
   `pnpm build`, which `pnpm release` runs; each published package's `prepack` refuses to pack
   without it, so packing a package on its own needs `pnpm build` first. Merge the "Version
   Packages" pull request only once every CI check on it has passed.

### A new package on npm

The release workflow publishes through npm trusted publishing: no token, but each package needs
a trust link to `release.yml`, and npm only takes one for a package that already exists. Nobody
publishes a real version by hand.

1. Just before merging the pull request that first releases the package, run
   `pnpm release:setup`, logged in to npm. With no arguments it takes every public package in the
   repo that isn't on npm yet; name packages (`pnpm release:setup <pack-id>…`) to pick some, or
   pass `--all` to include those already on npm, whose trust commands it only prints (to renew a
   link, delete the old one first). For each new package it stages a placeholder version
   (`0.0.0-trust`, tag `placeholder`), which makes npm create the package, and waits until npm
   shows it. Never stage the real version: a staged version can't be published again.
2. Run the `npm trust github …` commands it prints in your own terminal; npm asks for 2FA in the
   browser.
3. Merge the "Version Packages" pull request within two days. A trust link that no publish has
   used expires, and the publish then fails with `E404 Not Found` on `PUT`; delete the link on
   npmjs.com and create it again. A package whose first version was published by hand keeps an
   unused link until its first release from CI, so renew it just before that release.
4. A new package's first version can take up to an hour to show on npm. A re-run of the release
   in the meantime fails with `E409 Cannot publish over previously staged version`; wait instead.
5. Once `npm view <package> versions` lists the real version, reject the placeholder with the
   printed `npm stage reject <id>`. Not before: rejecting a package's only version deletes the
   package.

## Character files

A character file records the `specVersion` it was written against, and the exact pack versions it uses.
