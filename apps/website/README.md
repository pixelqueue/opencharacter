# website

The documentation website, for app developers, pack authors and implementers: the apps and packs,
the app guides, the spec and the project pages, published as a static
[Astro Starlight](https://starlight.astro.build/) site on GitHub Pages at
https://opencharacterformat.org/. It is private (`@opencharacter/website`, `private: true`): the
site is deployed, the package is never published to npm.

- `pnpm website` (from the repo root) starts it at http://localhost:4321/.
- `pnpm build:website` builds it into `apps/website/dist/`, writes the files for agents, then
  checks every internal link and anchor. A broken link fails the build.
- The address is in `site.ts` (origin and base path); everything that builds a URL reads it.

## Where the pages come from

Nothing under `src/content/docs/` is written by hand. `scripts/sync-docs.ts` generates it from
the repo before every `dev` and `build`, so the Markdown in the repo stays the only source:

| Source                                               | Page                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `home.md`                                            | The home page                                                        |
| `guides/*.md` (in this app)                          | `guides/…` (the guides README is `guides/`)                          |
| `packages/spec/docs/*.md`                            | `spec/…` (the spec README is `spec/`)                                |
| `glossary.md` (in this app)                          | `project/glossary`                                                   |
| `data/ecosystem.yaml` (in this app); every pack      | The home page's verified apps; its official packs                    |
| Each `@opencharacter/*` package's `package.json`     | `project/packages`, except the apps                                  |
| `CONTRIBUTING.md`, `AGENTS.md`, `CODE_OF_CONDUCT.md` | `project/contributing`, `…/working-in-the-repo`, `…/code-of-conduct` |
| `packages/spec/schemas/`                             | Served as-is under `schemas/0.2/`                                    |

Each page's title is its first `#` heading. Links between synced documents become site links;
links to anything else in the repo (schemas, packs, code) point at the file on GitHub.

To add a page, add the Markdown file in the repo and, for a new spec chapter, guide or project
page, its place in `scripts/sync-docs.ts`. The guides for app developers and the glossary are
written for the site itself, so they live here.

## Search and agents

- **Descriptions.** Each synced page's meta description is its first paragraph of prose, cut to 160 characters (`describe` in `scripts/sync-docs.ts`).
- **Head.** `src/routeData.ts` (Starlight route middleware) gives the home page its title, type
  and JSON-LD (`WebSite`, `SoftwareSourceCode`), every doc page a `TechArticle` and breadcrumbs,
  and every page the social card. Each page links its Markdown copy (`rel="alternate"`).
- **Social card.** `public/og.png` is rendered from `og/card.html` by `pnpm -C apps/website og`
  (needs a Chromium in `CHROME`); it's committed, so builds don't need a browser.
- **Files for agents** (`scripts/agent-files.ts`, after the build, into `dist/`): every page as
  Markdown at its path plus `.md`; `llms.txt` (https://llmstxt.org) indexing them; `llms-full.txt`
  with every guide and spec chapter; `packs.json` with the official packs; and `robots.txt`.

## Look

The site uses JetBrains Mono for all text (SIL Open Font License 1.1, from Fontsource) and
Maragsâ Display by John David Maza for titles (`src/fonts/`, freeware). Both are bundled rather
than loaded from a font service, and set in `src/styles/site.css`.

Colors come from the project palette, also in `src/styles/site.css`, mapped onto Starlight's
color variables:

- **Dark mode:** dusk backgrounds, frost and neutral-blue text, lime accent.
- **Light mode:** a purp-200 background, dusk text, purp-600 accent.

A few steps the palette doesn't have are blends of two palette colors, including the muted text
color, which is blended so it meets WCAG AA contrast.

## Deploying

`.github/workflows/pages.yml` builds the site and deploys it to GitHub Pages. It runs only when
started by hand (Actions → Website → Run workflow), so pushing to `main` publishes nothing.
It needs Pages enabled with **GitHub Actions** as the source (repository settings →
Pages).

## License

[Apache 2.0](../../LICENSE), like the rest of the project; the bundled fonts keep their own
licenses (see Look).
