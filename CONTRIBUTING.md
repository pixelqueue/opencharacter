# Contributing to the Open Character Format

Thanks for helping. Start with [AGENTS.md](AGENTS.md): it lists where things live, the commands,
and the rules. This file covers what every contribution needs.

## Setting up

Use pnpm 10 (`packageManager` in `package.json` names the exact version). We develop on Node 26,
the version in `.nvmrc`, and the release job needs it. Node 22 and 24 work for everything else:
CI runs the tests on both, and pnpm only warns about the engine. Then run `pnpm install` and
`pnpm check`.

`pnpm release:check` and the upgrade-fixture test read the published releases from git tags. In a
shallow clone, or a fork without tags, run `git fetch --tags` first.

## Developer Certificate of Origin (DCO)

Every commit must be signed off, confirming you wrote it or otherwise have the right to submit
it under the project's licenses, per the [Developer Certificate of Origin](https://developercertificate.org/):

```sh
git commit -s -m "Add orc-2e longsword"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line. There is no contributor license
agreement: you keep your copyright and license your contribution under the licenses below.

## Licenses

- Code, spec, schemas and tests: [Apache 2.0](LICENSE).
- Content packs: **every pack declares its license** in `pack.yaml`. Original packs use
  `CC0-1.0` (see [`packs/LICENSE`](packs/LICENSE)). Packs derived from licensed material keep
  that license and carry its required `credit` line (CC-BY and ORC packs must have one) and
  any other notices it requires in `notices` (ORC packs must have `orc`, `reserved-material`
  and `expressly-designated`; OGL packs `ogl-license` and `section-15`). Packs for games that
  aren't openly licensed may only carry mechanics (`license: mechanics-only`): no rules text,
  flavor text or logos; the contributors' own work in them is CC0, and they carry any credit or
  notices their source asks for.
- Packs that carry text from a game that isn't openly licensed need the rights holder's
  permission. They declare a `LicenseRef-` license (such as
  `LicenseRef-draw-steel-creator-license`) with a `credit` and a `permission` notice that states
  the permission.
- Every pack has a `LICENSE` file with its terms, credit and notices, and its `package.json`
  names it (`SEE LICENSE IN LICENSE`, or the SPDX identifier for CC-BY packs); the bundle's
  `LICENSE` repeats every pack's credit and notices. `pnpm test` checks both against
  `pack.yaml`.
- Don't submit copyrighted text you don't have the right to share. Translating copyrighted text
  is still copying it.

## Making a change

1. Read the relevant spec chapters (`packages/spec/docs/`).
2. Make the change; one content item per file. After changing a schema, run `pnpm types`.
3. Add a conformance case for an engine or pack change (see
   [the test suite](packages/spec/tests/README.md)), and update the docs, guides and READMEs it
   touches.
4. Add a changeset if it changes a published package or pack (`pnpm changeset`).
5. Run `pnpm format`, then `pnpm check` (lint, typecheck, tests, `pnpm validate`); also
   `pnpm release` and `pnpm build:website` when you change packs, scripts or docs.
6. Open a pull request. CODEOWNERS routes review to the spec's or the game's maintainers.

## Releases

A change to a published package or pack adds a changeset (`pnpm changeset`; while a package is
0.x, `minor` for a breaking change, `patch` otherwise) in the same pull request;
`pnpm release:check` then checks the pack as the version it will get. A pack change that changes saved
state's shape also adds its upgrade script (`upgrades/<from>-to-<to>.yaml`) and a fixture for it
in `scripts/release/upgrade-fixtures/`: a character saved at the old version and what the upgrade
must leave, which CI runs against the published releases. Name it
`<pack>-<from>-to-<to>-<name>.yaml` (such as `5e-srd-5.1-0.3.0-to-0.4.0-lich.yaml`).

A change that removes or retypes something apps or homebrew use (a derived field, an action, a
parameter, a situational choice, a tag, an enum value) is an interface change: it needs a
breaking bump but no upgrade script. A pack that uses a spec key or function newer than its
`specVersion` fails the check too. `pnpm release:check` names each change and what it needs (see
[upgrades](packages/spec/docs/upgrades.md#a-packs-interface)).

On `main`, the release workflow opens a
"Version Packages" pull request from pending changesets; merging it publishes the new versions
to npm through trusted publishing (no token), with provenance, and tags them. Nobody publishes by hand. See
[versioning](packages/spec/docs/versioning.md#the-release-flow).

## Proposing a spec change

Spec changes start as a GitHub issue, before any pull request. Describe:

- **What you were modeling:** the game, the rule, and where it appears.
- **What's missing:** what the format can't express, or expresses badly.
- **Your workaround,** if you found one, and why it falls short.
- **Options:** the changes you see, with their trade-offs.

Open questions and ideas that aren't a concrete gap yet go in GitHub Discussions. Once the
maintainers agree on a change, it lands as a pull request that updates the spec docs, schemas,
fixed sets and standard text, the conformance tests, the reference engine and the guides
together, with changesets for the spec and the engine.

## Takedowns

If you are a rights holder and believe material in this repository infringes your rights, open
an issue or email [info@pixelqueue.io](mailto:info@pixelqueue.io); the material will be reviewed
and removed where appropriate.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
