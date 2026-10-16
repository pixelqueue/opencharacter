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
- Each pack declares the **minimum** spec version it needs (`specVersion` in `pack.yaml`). `loadRuleset` refuses a pack that needs a newer spec than the engine implements (`spec-version-unsupported`).
- Pack versions are [semver](https://semver.org/) and follow its convention for 0.x. A **breaking bump** is a minor bump while the version is 0.x (0.1.4 → 0.2.0) and a major bump from 1.0.0 on (1.4.2 → 2.0.0); any smaller bump is non-breaking. A dependency range such as `^0.1.0` accepts only non-breaking bumps (`>=0.1.0 <0.2.0`).
- Pack versions follow the upgrade rule in [upgrades.md](upgrades.md): a version that changes the saved state's shape, or the pack's interface, gets a breaking bump; a shape change also ships an upgrade script.
- There is one package per pack. The reason is versioning, not size: each version must mean only "this pack changed". Translations for languages other than the default live in a separate `-i18n` package, so translation fixes never bump the mechanics pack.

## The release flow

1. **Describe the change:** `pnpm changeset`, picking the packages and bump types. While a
   package is 0.x, a breaking change is a `minor` changeset and anything else a `patch`; a
   `major` changeset takes it to 1.0.0.
2. **Version:** `pnpm version-packages` runs `changeset version`, then copies each pack's new
   `package.json` version into its `pack.yaml`, since that is the version characters pin.
3. **Check:** `pnpm release` runs every check, builds the packs, then runs `pnpm release:check`.
   For each pack it compares the new release with the last published one, found by git tag
   (`@opencharacter/<id>@<version>`):
   - a version that is already published must build to the same release
     (`published-version-changed` otherwise);
   - otherwise `checkRelease` against the latest lower version must pass: shape changes need a
     breaking bump and a covering upgrade script ([upgrades.md](upgrades.md#the-build-check)).
4. **Publish:** the release workflow (`.github/workflows/release.yml`) runs on every push to
   `main`. With pending changesets it opens a "Version Packages" pull request that runs step 2;
   with none it runs `pnpm release`, then `changeset publish`, which publishes every package
   whose version isn't on npm yet (with npm provenance) and tags it. Built output (`dist/`: the
   engine, text and spec modules, the packs' releases and text, the bundle) comes from
   `pnpm build`, which `pnpm release` runs; each published package's `prepack` refuses to pack
   without it, so packing a package on its own needs `pnpm build` first.

## Character files

A character file records the `specVersion` it was written against, and the exact pack versions it uses.
