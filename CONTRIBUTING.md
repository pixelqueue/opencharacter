# Contributing to the Open Character Format

Thanks for helping. Start with [AGENTS.md](AGENTS.md): it lists where things live, the commands,
and the rules. This file covers what every contribution needs.

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
- Every pack has a `LICENSE` file with its terms, credit and notices, and its `package.json`
  names it (`SEE LICENSE IN LICENSE`, or the SPDX identifier for CC-BY packs); the bundle's
  `LICENSE` repeats every pack's credit and notices. `pnpm test` checks both against
  `pack.yaml`.
- Don't submit copyrighted text you don't have the right to share. Translating copyrighted text
  is still copying it.

## Making a change

1. Read the relevant spec chapters (`packages/spec/docs/`).
2. Make the change; one content item per file.
3. Run `pnpm check` (lint, typecheck, tests, `pnpm validate`), and `pnpm release` and
   `pnpm build:website` when you change packs, scripts or docs.
4. Open a pull request. CODEOWNERS routes review to the spec's or the game's maintainers.

## Releases

A change to a published package or pack adds a changeset (`pnpm changeset`; while a package is
0.x, `minor` for a breaking change, `patch` otherwise) in the same pull request;
`pnpm release:check` then checks the pack as the version it will get. A pack change that changes saved
state's shape also adds its upgrade script (`upgrades/<from>-to-<to>.yaml`) and a fixture for it
in `scripts/release/upgrade-fixtures/`: a character saved at the old version and what the upgrade
must leave, which CI runs against the published releases. On `main`, the release workflow opens a
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
conformance tests and reference engine together.

## Takedowns

If you are a rights holder and believe material in this repository infringes your rights, open
an issue or email [info@pixelqueue.io](mailto:info@pixelqueue.io); the material will be reviewed
and removed where appropriate.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
