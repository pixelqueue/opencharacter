# Showing text

[Text and translation](text-and-translation.md) explains where text lives and how each key is
built. This page shows the shortcut: `@opencharacter/text`, a small helper that builds the keys
from engine output and formats the messages for you. The engine still returns no text; the
helper is on your app's side, and you can drop it for your own code at any time.

It's a reference helper, not part of the spec: another engine's output works with it too, and a
port needn't have one.

## A text bundle

Build one bundle per player language from the packs' text and the spec's standard text:

```ts
import { createText } from '@opencharacter/text';
import packsEn from '@opencharacter/packs/i18n/en';
import specEn from '@opencharacter/spec/i18n/en';

const text = createText({
  languages: ['en'], // lookup order, the player's language first: ['de', 'en']
  packs: { en: packsEn }, // by language, then pack ID
  spec: { en: specEn },
  contentTypes: ruleset.contentTypes, // optional: field defaults for content cards
  content: ruleset.content, // optional: content types for headlines
  display: ruleset.rules.display, // optional: field formats for headlines
  enumOrigins: ruleset.enumOrigins, // optional: names for values add-on packs add to enums
  optionOrigins: ruleset.optionOrigins, // optional: names for options add-ons add to choices
  familyOrigins: ruleset.familyOrigins, // optional: names for keys add-ons add to families
});
```

- `packs` is keyed by language, then pack ID, the shape of
  `@opencharacter/packs/i18n/<lang>`. A single pack's text goes in as
  `{ en: { '5e-srd-5.1': srdEn } }`; a character's homebrew text under the pack ID `homebrew`
  (`character.homebrew.i18n.en`).
- A key missing in every listed language falls back to any other language the bundle holds for
  that pack, so a pack's default language fills the gaps of a partial translation.
- Messages are formatted with ICU MessageFormat (`intl-messageformat`), in the language they
  were found in.
- A name that's missing comes back as the ID you passed, never as an error, so a gap shows up
  on screen instead of breaking it. `text.message(pack, key)` and `text.specMessage(key)`
  return `undefined` when you want to know.

## Names

```ts
text.content('5e-srd-5.1:armor.shield'); // 'Shield'
text.copy({
  item: '5e-srd-5.1:weapons.longsword',
  templates: ['5e-srd-5.1:magic-items.weapon-plus-one'],
});
// 'Longsword +1'
text.field('5e-srd-5.1:combat.ac'); // 'Armor Class'
text.field('5e-srd-5.1:combat.ac', { short: true }); // 'AC'
text.type('5e-srd-5.1:weapon'); // 'Weapon'
text.tag('5e-srd-5.1:save.int'); // 'Intelligence saving throw'
text.tag('save.int', '5e-srd-5.1'); // the same, for a tag as a set field holds it
text.setMember('skill.arcana', '5e-srd-5.1'); // 'Arcana': content, else field, else tag, else the ID
text.action('5e-srd-5.1:features.fighter.second-wind#second-wind'); // 'Second Wind'
text.band('fitd-scoundrel:action', 'partial'); // 'Partial success'
```

## Content cards

A spell, a weapon or a feat reads best as a card: a header from its mechanics, then its text.
Packs write the header as a **block**, a text template per content type, so you
never lay one out from field names:

```ts
const fireBolt = ruleset.content['5e-srd-5.1:spells.fire-bolt'];
text.contentBlock(fireBolt);
// '**Fire Bolt** — *Evocation cantrip* · 1 action · 120 ft · V, S · Instantaneous'
text.contentCard(fireBolt);
// the block, a blank line, then the description: 'You hurl a mote of fire at a creature …'
text.value('5e-srd-5.1:spell', 'school', 'evocation'); // 'Evocation'
```

- **Show `contentCard`** for an item's card. It is Markdown: the block and the description, or
  whichever the item has; `undefined` when it has neither. `contentBlock` is the header alone,
  `undefined` when the pack has no block for the item.
- **Pass the item as the ruleset holds it** (`ruleset.content[id]`). For a copy on a sheet, also
  pass the copy, `{ templates, tags, fields, state, computed }` (`templates`, `tags` and
  `fields` from computeSheet's `templated` entry for the copy, `computed` from `copies[entry]`),
  so the card names a Longsword +1 and shows its merged fields and the copy's state. A spell
  known that content keeps templates on (a longer range) has a `templated` entry with its
  `activation` (its index in `activations`) instead of `entry`: pass its
  `{ templates, tags, fields }` the same way. The same spell known twice (through two classes) is
  two activations, each listed with its own templates.
- **Give the bundle `contentTypes`** (`ruleset.contentTypes`), or pass the item's type as the
  third argument: a field the item leaves out then reads as its declared default (a Fate stunt's
  `action: any`), as the rules read it.
- **Render the Markdown**, or show it as plain text, as you do descriptions.
- **A field the player names** (a orc-2e Lore of their city) has `name` on its
  computeSheet value: pass it, `text.field(id, { name: sheet.values[id].name })` ("Absalom
  Lore"); without it the text reads "Lore".
- **Templates have cards too**: pass a template as the ruleset holds it (a orc-2e
  rune, `type: 'template'`) and `contentCard` gives its own block ("**Flaming rune** — _Rune 8_
  · Magical, Property rune · 500 gp") and description.
- `text.value(type, field, value)` names an enum value outside a card, for a filter or a
  column. A rules-level field's enum value is `text.fieldValue(field, value)`
  (`fields.<field>.values.<v>.name`: `creature.size`'s `medium` is "Medium"), and an action
  parameter's `text.paramValue(action, param, value)`
  (`<actionKey>.params.<param>.values.<v>.name`).

## Forms: item fields and parameters

A form labels each input with the pack's text, never a humanized ID:

```ts
text.typeField('mork-borg-core:weapon', 'attackDrModifier'); // 'Attack DR modifier'
text.typeFieldDescription('5e-srd-5.1:armor', 'maxDex'); // 'The most Dexterity modifier AC adds.'
text.templateField('5e-srd-5.1:acBonus'); // 'AC bonus', for a custom template's form
text.param('mork-borg-core:test', 'dr'); // 'Difficulty rating (DR)'
text.paramDescription('mork-borg-core:test', 'dr');
// 'The target to beat. 12 for most rolls; the GM raises or lowers it.'
```

- **Every item field has a name** (`types.<type>.fields.<field>.name`); a hint
  (`.description`) is optional, one line, for help text under the input. Missing text falls
  back to the field's ID; a missing hint is `undefined`.
- **A parameter's hint** is `<actionKey>.params.<param>.description`, optional. `action` is
  `needs.action`'s form, so an inline action is `<item>#<action>`. A parameter with an
  explicit `label` key is named by `text.lookup` with that key.

## Headlines

A character list wants a line under each name: "Level 3 Hill dwarf Wizard", not the pack's name.
Each pack words it as its `headline`, a text template, so your app needs no
code per game:

```ts
const sheet = computeSheet(ruleset, character);
text.headline(sheet, character); // 'Level 3 Hill dwarf Wizard'
text.headline(sheet, character) ?? text.pack(character.packs[0].id); // with a fallback
```

| Pack           | A finished character                                                             | While it's created         |
| -------------- | -------------------------------------------------------------------------------- | -------------------------- |
| 5E SRD 5.1     | "Level 3 Hill dwarf Wizard", "Hill dwarf Wizard 2 / Fighter 1", "Goblin, CR 1/4" | "Dwarf", then "Hill dwarf" |
| 5E SRD 5.2     | "Level 3 Elf Wizard", "Elf Wizard 2 / Fighter 1", "Goblin Warrior, CR 1/4"       | "Elf"                      |
| orc-2e         | "Level 2 Elf Rogue"                                                              | "Elf"                      |
| FitD scoundrel | a table's own playbook: "Bruiser", "Bruiser of the Ravens" with the crew's name  | nothing without a playbook |
| FitD crew      | "Tier 1", or "Tier 1 Shadows" with a table's own crew type                       | "Tier 0"                   |
| Mothership     | "Marine"                                                                         | nothing before a class     |
| Fate Core      | the high concept                                                                 | nothing before one         |
| MÖRK BORG      | "Heretical Priest", "Classless", "Ancient Gore-Hound"                            | nothing before a class     |

- **`undefined` means fall back:** no pack has a headline, or it words nothing yet (a sheet
  with nothing picked). Show the pack's name, or nothing.
- **Pass the character file** for its packs' order (the last pack with a headline words it,
  homebrew last), its copies' templates and state (a class's level).
- **Give the bundle `content` and `display`** (`ruleset.content`, `ruleset.rules.display`):
  without `content` a headline can't find the character's race or class; without `display` a
  number shows as is ("CR 0.25", not "CR 1/4").
- **Linked characters' names are yours:** the format doesn't name characters, so pass the names
  of the characters filling its link slots, by slot ID:
  `text.headline(sheet, ash, { links: { 'fitd-scoundrel:crew': 'the Ravens' } })` is
  "Bruiser of the Ravens".
- It's plain text on one line: no Markdown, spaces collapsed.

## Choices

A choice's prompt comes from its **owner**, never from its path. Pass any entry of
`computeSheet`'s `choices` (or a pause's `needs.choice`):

```ts
const sheet = computeSheet(ruleset, marine);
for (const choice of sheet.choices) console.log(text.choicePrompt(choice));
// 'Choose one Expert skill or two Trained skills'
// 'Choose two Trained skills'   (owner: …classes.marine.choices.bonus-skills.options.trained)
```

A slot of a slotted choice is worded with its number: a wizard's spellbook slots read "Choose
six 1st-level spells for your spellbook", then "Choose two spells for your spellbook (level 2)".

An option is labeled by `text.option(id, context)`, whatever its kind:

| Option ID                                                 | Label from                                                                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `#done`                                                   | the spec's `actions.options.done.name` ("Done"); over pending choices (`context.choice`) `actions.options.done.pending.name` ("Skip the rest")         |
| `<content id>#<option>` (added by content)                | `<content>.options.<option>.name` in the content's pack                                                                                                |
| a content ID                                              | the item's name                                                                                                                                        |
| a copy's instance ID (`context.copies`)                   | the copy's name                                                                                                                                        |
| an inline option or value (`context.choice`)              | `<owner>.choices.<choice>.options.<id>.name`, else as a set member (`skill.arcana` is "Arcana")                                                        |
| a written option or value of an action (`context.action`) | for a value, `<content>.options.<id>.name` first (`context.content`, a pause's `needs.content`); `<actionKey>.options.<id>.name`, else as a set member |

```ts
const bonus = sheet.choices[0];
text.option(bonus.picks[0], { choice: bonus }); // 'Two Trained skills'
```

## A paused action

`describeNeed` words a whole pause in one call:

```ts
import { describeNeed } from '@opencharacter/text';

const result = startAction(ruleset, character, input);
if (result.status === 'paused') {
  const { title, options, fields, dice, targets } = describeNeed(ruleset, text, result.needs, {
    character, // names the options of a step over copies
  });
}
```

| `needs.kind` | `title`                                                                | Also                                            |
| ------------ | ---------------------------------------------------------------------- | ----------------------------------------------- |
| `choice`     | the asked choice's prompt over pending choices, else the step's prompt | `options`, each `{ id, label }`                 |
| `allocate`   | the step's prompt                                                      | `fields`, each `{ id, label }`                  |
| `dice`       | the roll step's name, else the action's                                | `dice`, `roll`, and `targets` for a banded roll |
| `handoff`    | the name of the action the participant runs                            |                                                 |

A FitD action roll with a push, for a scoundrel with Battleborn:

```ts
{
  title: 'How do you pay for pushing yourself?',
  options: [
    { id: 'stress', label: 'Take 2 stress per push' },
    {
      id: 'fitd-scoundrel:special-abilities.battleborn#special-armor',
      label: 'Mark special armor instead of stress (Battleborn: pushing while fighting)',
    },
  ],
  fields: [],
}
```

A Mothership stat check with advantage, paused for dice:

```ts
{
  title: 'Stat check',
  options: [],
  fields: [],
  dice: '2d100, keep lowest',
  targets: [
    // …
    { band: 'success', name: 'Success', condition: 'Roll under 34 (90+ always fails)' },
    // …
  ],
}
```

## Rolls

- **Targets.** `text.rollTargets(summary)` words a roll summary (a dice pause's
  `needs.summary`, a log entry's `summary`): each band the roll can still reach with its name and
  what it needs. The pack's `bands.<set>.<band>.condition` text wins; without it, the spec's
  comparisons are joined ("10 or higher and under 20"). A band that holds whatever the roll has
  no condition unless its pack words one. The success threshold's target has `success: true`:
  `targets.find((t) => t.success)` is "what you need", when the roll has one.
- **Dice.** `text.dice(items)` words a roll's dice items (or `needs.dice`): "4d6, drop lowest",
  "2d20, keep highest - 1d4", "4dF", "5d6, exploding on 6": the dice to throw. Flat items are left
  out, and so is a keep or drop that can't change the roll: one die kept highest is "1d6". The
  words are the spec's `dice.*` text, so they translate like the rest.
- **Whole roll.** `text.roll(items)` words the same items with the flat ones summed after the
  dice, so the player sees what the total adds: a Mothership stat roll is "2d10 + 25", a check
  "1d20 - 1". `describeNeed` gives both, `dice` and `roll`.
- **Rolled twice.** Pass a dice pause's `needs.repeat` too, `text.dice(needs.items,
  needs.repeat)`, for a whole roll made more than once: "2d6, rolled twice, keep the lower
  total" (`dice.repeat`). When only some items are rolled again (`repeat.items`), they are worded
  together in `dice.grouped`: "(2d6, rolled twice, keep the higher total) + 3d6". `describeNeed`
  does it for you.

## Issues and errors

```ts
text.issue(issue); // the pack's own text when it has one, else the spec's
text.error(error); // the spec's text, data filled
```

- `prerequisite-not-met` uses `<owner>.prerequisites.<id>`, a phrase, wrapped by the spec's
  `issues.prerequisite-not-met.owner` with the owner's name: "Terrain Scout requires: Scout
  Dedication". `constraint-failed` uses `constraints.<id>`, and `too-many-copies` the type's
  `types.<type>.copies` ("A character has only one race"), each with the issue's `data` as
  arguments.
- Some codes have text by their data: an `out-of-range` with only a `min` reads `"Maximum HP"
  must be at least 1.` (`errors.out-of-range.min`), and a `safety-limit-exceeded` has a sentence
  per limit (`errors.safety-limit-exceeded.maxOverflowChain`).
- Text whose data is missing an argument is never shown raw. A code with no text, or whose text
  misses an argument, reads as the error's `data.message` when it has one, else `errors.other`
  ("Something went wrong."). Neither shows the code: log the error itself for developers.

```ts
function showError(error: EngineError) {
  console.warn(error.code, error.path ?? '', error.data ?? {}); // for developers
  return text.error(error); // for the player
}
```

- The spec's generic text gets `data` with IDs replaced by names:
  `{ code: 'not-input-field', data: { field: '5e-srd-5.1:combat.ac' } }` reads
  `"Armor Class" is calculated and cannot be set directly.`

## Your own formatter

The key builders are exported as `keys`, each returning `{ pack, key }` (`pack: null` for the
spec's text), if you'd rather format messages yourself:

```ts
import { keys } from '@opencharacter/text';

keys.choicePromptKey(choice); // { pack: 'mothership-1e', key: 'classes.marine.choices.…prompt' }
keys.stepKey({ action: 'mothership-1e:panic-check', step: 'panic/panic' });
// { pack: 'mothership-1e', key: 'actions.panic-check.steps.panic.prompt' }
```

The helper doesn't follow an explicit `prompt` or `label` written in the mechanics (no official
pack has one); if your packs use them, look those keys up with `text.message`.

## Next

- [Changing characters](changing-characters.md).
