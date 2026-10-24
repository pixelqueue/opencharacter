# @opencharacter/engine

The TypeScript reference engine for the [Open Character Format](https://opencharacterformat.org/)
(OCF), for apps that build, show and change tabletop RPG characters: it loads packs into a
ruleset, computes a character's sheet, lists options, applies changes and runs actions and dice.
It has no runtime dependencies on Node, so it runs in browsers, servers and workers. It ships as
ES modules with type declarations, for Node 22 and later and current browsers.

## Install

```sh
pnpm add @opencharacter/engine @opencharacter/5e-srd-5.1
```

## Example

```ts
import { computeSheet, loadRuleset } from '@opencharacter/engine';
import type { CharacterFile } from '@opencharacter/engine';
import srd from '@opencharacter/5e-srd-5.1';

const loaded = loadRuleset([srd]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

const character: CharacterFile = {
  specVersion: '0.3.0',
  id: 'example',
  packs: [{ id: '5e-srd-5.1', version: '0.3.0' }],
  values: { '5e-srd-5.1:abilities.str.base': 16 },
};

const sheet = computeSheet(loaded.ruleset, character);
console.log(sheet.values['5e-srd-5.1:abilities.str.mod']?.value); // 3
```

The [quick start](https://opencharacterformat.org/guides/quick-start/) goes on to change the
character and roll an attack.

## API

The engine calls, as the spec defines them
([engine interface](https://opencharacterformat.org/spec/engine-interface/)):

| Export                          | What it does                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `loadRuleset`                   | Merges packs (releases or sources) into a ruleset and checks every reference. |
| `computeSheet`                  | A character's computed values, actions, choices and issues.                   |
| `listOptions`                   | The options a choice offers, with what each would need.                       |
| `applyChanges`                  | A new character file with changes applied; the one passed in is untouched.    |
| `startAction`, `continueAction` | Run an action: rolls, pauses for the player's input, outcomes.                |
| `upgrade`, `checkRelease`       | Move a character to newer pack versions; check a pack release.                |
| `withHomebrew`                  | A ruleset with a character's own homebrew added.                              |
| `resolveId`                     | Resolves an ID as formulas do.                                                |
| `buildRelease`                  | Builds a pack release from pack sources.                                      |
| `randomDice`, `diceFrom`        | The dice an action rolls: random, or from given results.                      |
| `formula`, `check`              | The formula parser, printer and type checker; the pack formula checks.        |
| `SPEC_VERSION`                  | The spec version it ships with.                                               |
| `IMPLEMENTS_SPEC`               | The spec major.minor versions it implements, derived from `SPEC_VERSION`.     |

The types (`CharacterFile`, `Ruleset`, `PackRelease` and the call inputs and outputs) come with
it. The [guides](https://opencharacterformat.org/guides/) show each call in an app, and the
[spec](https://opencharacterformat.org/spec/) defines them; the engine passes the spec's shared
conformance suite, in [`@opencharacter/spec`](https://www.npmjs.com/package/@opencharacter/spec).

## Performance

`listOptions` evaluates an option's prerequisites on a trial sheet only for options that declare
prerequisites. A sheet runs a query choice's query once per choice and keeps the item views its
queries build. Results depend only on a call's input. A few caches outlive a call, but
none changes a result: item views that read no input field, kept per ruleset, and the sheets
and option lists of an action's run, which the paused result carries to the next answer, so a
replay doesn't build them again.

## License

[Apache 2.0](LICENSE).
