# AGENTS.md

The entry point for anyone working in this repo, person or agent. It's a map: follow the links.

## Read first

1. [`packages/spec/docs/`](packages/spec/docs/README.md): the spec. It is the source of truth.
2. [`apps/website/guides/`](apps/website/guides/README.md): the guides for app developers.
3. [`apps/website/glossary.md`](apps/website/glossary.md): what OCF's terms mean.

The documentation website (https://opencharacterformat.org/) is built from these files.

## Where things live

| Path                     | What                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/spec/schemas/` | JSON Schemas (draft 2020-12); `engine/` holds call inputs and outputs                                                                                                  |
| `packages/spec/data/`    | Fixed sets as data (effect operations, dice modifiers, change types, stacking policies, error codes, formula context, …)                                               |
| `packages/spec/docs/`    | Spec docs for implementers                                                                                                                                             |
| `packages/spec/i18n/`    | Standard text for the spec's error and rules-issue codes                                                                                                               |
| `packages/spec/tests/`   | Shared conformance test suite                                                                                                                                          |
| `packages/engine/`       | Reference engine (TypeScript)                                                                                                                                          |
| `packages/text/`         | Wording helper (TypeScript): engine output to finished text                                                                                                            |
| `packages/packs/`        | The `@opencharacter/packs` bundle of every official pack                                                                                                               |
| `apps/web-editor/`       | Local pack editor (`pnpm editor`); private, never published                                                                                                            |
| `apps/website/`          | Documentation website (Astro Starlight, GitHub Pages): guides, glossary, and the spec synced in; private, never published                                              |
| `packs/<game>/<pack>/`   | One pack (ID `<game>-<pack>`, version from 0.1.0): `pack.yaml`, `rules/`, `content/`, `i18n/`, `upgrades/`. A game folder holds that game's editions and content packs |
| `examples/characters/`   | Example character files                                                                                                                                                |
| `scripts/`               | `validate`, `build:packs`, `release:check`, `release:setup` and `types`                                                                                                |

## Commands

| Command                 | Does                                                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`          | Install (Node 26, pnpm 10)                                                                                                                                                                                                              |
| `pnpm lint`             | oxlint, then oxfmt in check mode                                                                                                                                                                                                        |
| `pnpm format`           | Format everything with oxfmt (TS, JSON, YAML, Markdown)                                                                                                                                                                                 |
| `pnpm typecheck`        | TypeScript, strict                                                                                                                                                                                                                      |
| `pnpm test`             | Vitest: schemas, fixed sets, validator, engine, conformance suite, release scripts; the upgrade-fixture test needs git tags                                                                                                             |
| `pnpm validate`         | Check every pack and example character against the schemas and check every reference                                                                                                                                                    |
| `pnpm types`            | Regenerate the TypeScript types in `packages/spec/src/types.ts` from the schemas (run after changing a schema)                                                                                                                          |
| `pnpm editor`           | Start the local pack editor (`apps/web-editor`) at http://127.0.0.1:5173                                                                                                                                                                |
| `pnpm website`          | Start the documentation website (`apps/website`) at http://localhost:4321/                                                                                                                                                              |
| `pnpm build:website`    | Build the website into `apps/website/dist/` and check every internal link                                                                                                                                                               |
| `pnpm build`            | Build every published package: `build:ts` (spec, engine and text to `dist/` with tsc), then `build:packs`                                                                                                                               |
| `pnpm build:packs`      | Validate, then build every pack's release (`dist/`), the `@opencharacter/packs` bundle and the spec's text modules                                                                                                                      |
| `pnpm release:check`    | Compare each pack with its last published release (git tags): published versions unchanged, shape changes covered. Pending changesets count: a bumped pack is checked as its next version                                               |
| `pnpm release:setup`    | Before a new package's first release: create it on npm and print the trust steps (see versioning)                                                                                                                                       |
| `pnpm changeset`        | Describe a change to a published package: which packages, which bump                                                                                                                                                                    |
| `pnpm version-packages` | `changeset version` (it also moves dependency ranges a bump breaks), then sync `pack.yaml` versions, every pin of a bumped pack's old version, and the spec version (`SPEC_VERSION`, `schemas/X.Y/`, example characters' `specVersion`) |
| `pnpm release`          | Every check, `pnpm build` and the release check. Publishing happens only in CI (`release.yml`)                                                                                                                                          |
| `pnpm check`            | Lint, typecheck, test and validate. CI also runs `build:packs`, `release:check`, the upgrade-fixture test and `build:website`                                                                                                           |

Run `pnpm check` before every commit, and `pnpm release` and `pnpm build:website` too when you
change packs, scripts or docs.

## Rules

- **Mechanics in `content/` and `rules/`, text in `i18n/`.** No player-facing string next to
  mechanics. One file per content item; its `id` matches its path.
- **No copyrighted rules text** from games that aren't openly licensed. Mechanics-only packs
  hold the math and names only. Open-licensed packs keep their license and credit line.
- **Every pack that starts a sheet offers a random start** (`random: true` in `creation`) beside
  its guided one: its steps recommend every pick, so an automatic run finishes. Where the book
  has no random method, the pack picks reasonable odds.
- **Every pack declares a license** in `pack.yaml` (and a `credit` for CC-BY; a `credit` and
  `notices` for ORC).
- **No PDF support, no hosted service.** The only editor is the local `apps/web-editor`.
- **Packages and packs publish only through the release workflow** (changesets on `main`, see
  [versioning](packages/spec/docs/versioning.md#the-release-flow)); never `npm publish` by hand.
- **A change to a published package adds its changeset in the same PR.**
- **An upgrade script ships with a fixture** in `scripts/release/upgrade-fixtures/`: saved data
  of the old shape and what the upgrade must leave.
- **In the repo, packages resolve to their TypeScript sources** through the
  `@opencharacter/source` export condition (tsconfig, vitest, the editor's Vite config, `tsx
  --conditions`), so nothing needs a build first. Outside it, they resolve to `dist/`.
- **Commits are small, logical and signed off** (`git commit -s`, DCO; see
  [CONTRIBUTING.md](CONTRIBUTING.md)).

## When the format falls short

Model a game with the features the format has; prefer a clever use of them to a hack. When the
format can't express a rule, or a spec change would help, open a GitHub issue (see
[CONTRIBUTING.md](CONTRIBUTING.md#proposing-a-spec-change)). Don't change the spec silently.
