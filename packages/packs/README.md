# @opencharacter/packs

Every official [Open Character Format](https://opencharacterformat.org/) (OCF) pack in one
install, for apps that want all of them: each pack's release by pack ID, and each pack's English
text. It depends on each pack's own package and re-exports it.

## Install

```sh
pnpm add @opencharacter/packs @opencharacter/engine
```

## Example

```ts
import { loadRuleset } from '@opencharacter/engine';
import all, { packs } from '@opencharacter/packs';
import en from '@opencharacter/packs/i18n/en';

const loaded = loadRuleset([packs['5e-srd-5.1']]);
console.log(all.length, en['5e-srd-5.1']['spells.fireball.name']); // 7 'Fireball'
```

- `default`: every pack's release, as an array.
- `packs`: each release by pack ID.
- `@opencharacter/packs/i18n/en`: each pack's English text by pack ID (also as JSON,
  `i18n/en.json`).

The [Packs and rulesets](https://opencharacterformat.org/guides/packs-and-rulesets/) guide covers
loading packs and showing their credits.

## Licenses

Each pack keeps its own license; this package only re-exports the packs and copies their English
text, under the same licenses:

| Pack             | License                                                          | Credit and notices                                           |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| `5e-srd-5.1`     | CC-BY-4.0                                                        | `credit` (the SRD 5.1 attribution)                           |
| `fate-core`      | CC-BY-3.0                                                        | `credit` (Evil Hat's attribution)                            |
| `orc-2e`         | ORC License                                                      | `credit`; `orc`, `reserved-material`, `expressly-designated` |
| `fitd-scoundrel` | mechanics-only (own work CC0 1.0; SRD material CC-BY-3.0)        | `credit` (the SRD's attribution)                             |
| `fitd-crew`      | mechanics-only (own work CC0 1.0; SRD material CC-BY-3.0)        | `credit` (the SRD's attribution)                             |
| `mork-borg-core` | mechanics-only (own work CC0 1.0), MÖRK BORG Third Party License | `credit`; `not-affiliated`                                   |
| `mothership-1e`  | mechanics-only (own work CC0 1.0)                                | none                                                         |
| `wn-cyber`       | CC0-1.0                                                          | `not-affiliated`                                             |
| `wn-fantasy`     | CC0-1.0 (the Worlds Without Number SRD)                          | `not-affiliated`                                             |
| `wn-scifi`       | free edition text by the author's permission (own work CC0 1.0)  | `credit`; `permission`, `not-affiliated`                     |

**How credits and notices reach users:** each pack's `credit` and `notices` are in its release's
manifest, and `loadRuleset` lists them in the ruleset's `packs`. An app that uses a pack's content
must show them to its users (an About or Credits screen is the usual place); the spec requires it
([packs](https://opencharacterformat.org/spec/packs/)). This package's [`LICENSE`](LICENSE)
repeats every pack's credit and notices verbatim, and each pack's package has its own `LICENSE`.
The package's own code (the generated index files) is under Apache 2.0.

Built by `pnpm build` in the OCF repository.
