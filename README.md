<p align="center">
  <a href="https://opencharacterformat.org/">
    <img src="apps/website/public/favicon.svg" alt="" width="80" height="80">
  </a>
</p>

<h1 align="center">Open Character Format</h1>

<p align="center">
  <strong>One character format for every tabletop RPG.</strong><br>
  Packs hold a game's rules as data, an engine runs them, and every app that speaks OCF reads the
  same characters.
</p>

<p align="center">
  <a href="https://opencharacterformat.org/">Website</a> ·
  <a href="https://opencharacterformat.org/guides/quick-start/">Quick start</a> ·
  <a href="https://opencharacterformat.org/guides/">Guides</a> ·
  <a href="https://opencharacterformat.org/spec/">Specification</a> ·
  <a href="https://opencharacterformat.org/project/packages/">Packages</a>
</p>

<p align="center">
  <a href="https://github.com/pixelqueue/opencharacter/actions/workflows/ci.yml"><img src="https://github.com/pixelqueue/opencharacter/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@opencharacter/engine"><img src="https://img.shields.io/npm/v/@opencharacter/engine?label=engine" alt="npm"></a>
  <a href="https://opencharacterformat.org/spec/"><img src="https://img.shields.io/badge/spec-0.1.0-61578c" alt="Spec 0.1.0"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-61578c" alt="Apache 2.0"></a>
</p>

## Why OCF

**The engine knows the rules. The app owns the experience.** Your app never writes a game's
math: it loads packs, asks the engine, and draws the answers.

- **Take it anywhere.** Packs, homebrew and characters move between every app that implements
  OCF: export from one, import into another.
- **One integration, every game.** The 5E SRD, ORC Second Edition fantasy, Forged in the Dark, Fate, MÖRK BORG,
  Mothership and a growing list run through the same engine calls.
- **The sheet can't disagree with the rules.** A character file holds only the player's choices;
  every value is computed, with a breakdown of where it came from.
- **Your dice, your UI.** The engine says what to roll and pauses while your app animates the
  dice and hands back what they landed on.
- **Fully internationalized.** The engine returns keys and codes, never English; text lives in
  translation files.
- **Bring your own language.** The spec is JSON Schemas and a plain-data conformance suite, so an
  engine can be written in Rust, Python, Go or anything else. Ours is TypeScript with no runtime
  dependencies.

## Quick start

```sh
npm install @opencharacter/engine @opencharacter/5e-srd-5.1
```

```ts
import { computeSheet, loadRuleset, type CharacterFile } from '@opencharacter/engine';
import srd from '@opencharacter/5e-srd-5.1';

const loaded = loadRuleset([srd]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

const tamsin: CharacterFile = {
  specVersion: '0.1.0',
  id: 'tamsin',
  packs: [{ id: '5e-srd-5.1', version: '0.1.0' }],
  values: { '5e-srd-5.1:abilities.str.base': 16 },
};

const sheet = computeSheet(loaded.ruleset, tamsin);
sheet.values['5e-srd-5.1:abilities.str.mod']?.value; // 3
```

Next: the [quick start](https://opencharacterformat.org/guides/quick-start/) changes
the character and rolls an attack, and
[Implementing OCF](https://opencharacterformat.org/guides/implementing/) maps out how
much of OCF your app needs.

## Official packs

| Pack                                      | Game                               | License        |
| ----------------------------------------- | ---------------------------------- | -------------- |
| [`5e-srd-5.1`](packs/5e/srd-5.1/)         | 5E System Reference Document 5.1   | CC-BY-4.0      |
| [`orc-2e`](packs/orc/2e/)                 | Second Edition fantasy rules (ORC) | ORC License    |
| [`mothership-1e`](packs/mothership/1e/)   | Mothership 1e                      | Mechanics only |
| [`fitd-scoundrel`](packs/fitd/scoundrel/) | Forged in the Dark scoundrel (SRD) | Mechanics only |
| [`fitd-crew`](packs/fitd/crew/)           | Forged in the Dark crew (SRD)      | Mechanics only |
| [`mork-borg-core`](packs/mork-borg/core/) | MÖRK BORG                          | Mechanics only |
| [`fate-core`](packs/fate/core/)           | Fate Core                          | CC-BY-3.0      |

Each pack is its own npm package (`@opencharacter/<pack>`), and
[`@opencharacter/packs`](packages/packs/) bundles them all. Mechanics-only packs model games that
aren't openly licensed: the rules' math and names, no rules text, and no affiliation with their
publishers.

## Packages

| Package                                     | What it is                                                         |
| ------------------------------------------- | ------------------------------------------------------------------ |
| [`@opencharacter/engine`](packages/engine/) | The reference engine: sheets, options, changes, rolls and upgrades |
| [`@opencharacter/spec`](packages/spec/)     | The spec: docs, JSON Schemas, fixed sets and the conformance suite |
| [`@opencharacter/text`](packages/text/)     | Turns engine output into finished text in the player's language    |
| [`@opencharacter/packs`](packages/packs/)   | Every official pack and its English text, in one install           |

## Built with OCF

- **[Realms of Shod](https://realmsofshod.com)**: build TTRPG realms and stories together with
  multiplayer tools, live transcription, and a knowledge graph that keeps your world alive.

Building something on OCF?
[Apply to be listed](https://docs.google.com/forms/d/e/1FAIpQLSdPZ2kFVWeawFlvxeBrSgBO3HFCFGRM7hWpEAgVyYzv00NDSQ/viewform).

## Contributing

Packs, fixes and engine ports are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), then
[AGENTS.md](AGENTS.md) for a map of the repository (it's written for people and agents alike).

## License

Code, spec, schemas and tests are [Apache 2.0](LICENSE). Original packs are [CC0](packs/LICENSE);
packs from licensed material keep that license and its credit line: `5e-srd-5.1` CC-BY-4.0,
`fate-core` CC-BY-3.0 and `orc-2e` the ORC License, each with its notices. `mothership-1e`, `mork-borg-core` and the Forged in the Dark packs are unofficial,
mechanics-only models whose own work is CC0; the Forged in the Dark packs keep the SRD's CC-BY credit line and
the MÖRK BORG pack the notices of its third-party license. Every package has a `LICENSE` file
with its terms, credit and notices.
