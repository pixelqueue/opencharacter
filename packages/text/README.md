# @opencharacter/text

The reference wording helper for the [Open Character Format](https://opencharacterformat.org/)
(OCF), for apps that show OCF characters to players: it turns engine output (choices, pauses,
options, issues, roll summaries and dice) into finished, ICU-formatted text in the player's
language, from pack text and the spec's standard text. The engine never outputs text; this is the
app's side, so every app needn't build text keys by hand.

## Install

```sh
pnpm add @opencharacter/text @opencharacter/engine @opencharacter/spec @opencharacter/packs
```

## Example

```ts
import { computeSheet, loadRuleset } from '@opencharacter/engine';
import { createText, describeNeed } from '@opencharacter/text';
import { packs } from '@opencharacter/packs';
import packsEn from '@opencharacter/packs/i18n/en';
import specEn from '@opencharacter/spec/i18n/en';

const loaded = loadRuleset([packs['5e-srd-5.1']]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const text = createText({ languages: ['en'], packs: { en: packsEn }, spec: { en: specEn } });

const sheet = computeSheet(loaded.ruleset, character);
text.choicePrompt(sheet.choices[0]); // 'Choose two Trained skills'
text.headline(sheet, character); // 'Level 3 Hill dwarf Wizard'
describeNeed(loaded.ruleset, text, paused.needs, { character }); // { title, options, fields, … }
```

`character` is a character file and `paused` a paused `startAction` or `continueAction` result.

## API

- `createText(options)`: the text bundle for the given languages (the first that has a key wins):
  names and descriptions of fields, content and actions, choice prompts, issues, roll summaries,
  headlines and blocks.
- `describeNeed(ruleset, text, needs, context)`: one call per pause of an action, the text for
  each thing it asks of the player.
- `keys`: the key builders, for apps with their own formatter.
- `blockArgument`, `headlineArgument`, `messageArguments`: the ICU arguments of a block,
  headline or message.

It reads only output shapes the spec fixes, so it works with any conforming engine. It is not
part of the spec's conformance. The guides
[Showing text](https://opencharacterformat.org/guides/showing-text/) and
[Text and translation](https://opencharacterformat.org/guides/text-and-translation/) cover it;
the spec's [i18n chapter](https://opencharacterformat.org/spec/i18n/) defines the text keys.

## License

[Apache 2.0](LICENSE).
