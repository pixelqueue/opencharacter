# @opencharacter/text

## 0.3.0

### Minor Changes

- 033d16d: A result band may mark its set's success threshold, `success: true`: the band a roll needs, what
  an app shows before the roll ("what you need"). A set marks at most one. The roll summary
  (`needs.summary`, a log entry's `summary`) and `text.rollTargets` carry the mark on its band; a
  pack's band condition text that needs a test's value no longer shows its raw template when the
  band has no tests. Every pack marks its banded checks, saves and attacks: the DC check's success,
  the attack's hit, Fate's `succeed` against the opposition, FitD's action roll at `partial` (a 4
  or 5 does what the player set out to do), Mothership's success and panic `pass`, Mörk Borg's test
  against the DR. Ladders, tables and fortune rolls have no threshold and mark none.
- 033d16d: Error text for equal bounds and enum values: `errors.out-of-range.exact` words an `out-of-range` whose bounds are equal (`"Effort" must be exactly 1.`), and `errors.wrong-type.values` a `wrong-type` for an enum, whose data now carries the enum's `values`. `text.error` names each value by its label (a parameter's from its action's text, a field's from the field's) and joins them as alternatives (`"For" must be The scene or The day.`).
- 033d16d: Additive choice options: a pack's rules' `extendChoices` adds items, written values or inline options to a dependency's content or rules-level choice (`<pack>:<content id>` or `<pack>:rules`, then the choice, `<choice>/<option>/<choice>` for a nested one) without overriding the owner, after the choice's own and in load order, so two add-ons never collide. Added inline options read the adding pack's fields and are named in its text under the owner's key; the ruleset's `optionOrigins` names each added value's and inline option's pack, which `createText` takes. The rules' `option` and `changes` effects now reach tagged action steps too (`<pack>:rules#<id>`, named `rules.options.<id>.name`), so an add-on offers its own option in a dependency's creation step. A bad addition is `invalid-extension`; dropping one is an interface change (`extension-removed`).
- 033d16d: Open enums reach action parameters, items' own state and view fields: `open: true` on a rules action's or an item's inline action's parameter, or on a state key an item declares, takes values from dependent packs' `extendEnums` (`<pack>:actions.<action>.params.<param>`, `<pack>:<item>.actions.<action>.params.<param>`, `<pack>:<item>.state.<key>`), checked by `startAction`, changes and `pnpm validate`; closing one is `enum-closed`. A declared view field marked `open: true` follows the open enum field of its ID, so a participant's or linked character's view may hold an added value. The ruleset's `familyOrigins` names the pack that added each family value; `createText` takes it (and names added parameter and item state values through `enumOrigins`), so a core values step over a family names an add-on's key from the add-on's text.
- 033d16d: Open enums: a rules field's or a content type's enum marked `open: true` takes values from the packs that depend on its pack, listed in their rules' `extendEnums` by the enum's address (`<pack>:types.<type>.fields.<field>`, `<pack>:types.<type>.state.<key>`, `<pack>:fields.<field>`) and named in their own text under the enum's key. Loading, item fields (`invalid-item-field`), saved values, changes and `pnpm validate` see the merged list; the ruleset's `enumOrigins` names each added value's pack, which `createText` takes to name it. A bad addition is `invalid-extension`; closing an open enum (`enum-closed`) and dropping an added value (`extension-removed`) are interface changes.
- 033d16d: Action parameter errors (`missing-param`, `wrong-type`, `out-of-range`, `invalid-option`) carry
  `action` (the qualified action ID; `<item ID>#<action ID>` for an item's inline action) and, for
  an action started on them, `entry` and `source`. Text names the parameter by its label
  (`"Helpers (+1 each)" must be at least 0.`).
- 033d16d: Advantage and disadvantage reach a roll's parts: with a `parts` target and `of: roll`, the
  matching parts' items are rolled again as a group and the better or worse total kept, the roll's
  other items rolled once (5E's Savage Attacker: the weapon's dice, not Sneak Attack's). Part
  sources are counted apart from the roll's own; a roll made again whole adds none. A dice pause's
  `repeat` gains `items`, the items rolled again, and `text.dice` words them together:
  "(2d6, rolled twice, keep the higher total) + 3d6" (`dice.grouped`) (#71).
- a26226f: Prerequisite text is a phrase, the requirement alone ("Scout Dedication"); the new standard text `issues.prerequisite-not-met.owner` (`{owner} requires: {requirement}`) names its owner. `text.issue` wraps a pack's prerequisite text with the owner's name, content or inline option, and `keys.issueKey` finds an inline option's prerequisite text (`<item>.choices.<choice>.options.<option>.prerequisites.<id>`). `pnpm validate` warns on prerequisite text that ends with a period or starts with "Requires" or "Needs".
- a26226f: Standard text by an error's data: `errors.out-of-range.min` and `errors.out-of-range.max` for an `out-of-range` with only one bound, and `errors.safety-limit-exceeded.<limit>` for each safety limit. `text.error` and `text.issue` use them, and show `errors.other` instead of the raw template when a message misses an argument. The `safety-limit-exceeded` and `out-of-range` descriptions in `error-codes.json` say what their data holds.
- 033d16d: `text.state(item, key, type?)` names a copy's state key, the item's own text first, else its
  type's ("Type", for "Type: Thugs"). It and `text.stateValue` take the item's type from the
  bundle's `content` when `type` is left out.
- 033d16d: An action inline on a content type, which every item of the type shares, is keyed under the
  type, `types.<type>.<action>…` (`types.stunt.use.name`), as `pnpm validate` already required;
  i18n.md now says so. Its ID is still `<item>#<action>`, so the text helper looks under the item's
  key, then, with `content` in the bundle, under its type's: `text.action`, `param`, `stepPrompt`
  and the rest name a Fate stunt's Use and a free invocation's Invoke instead of showing the ID.
- a26226f: `text.roll(items, repeat?)` words a whole roll, the flat items' sum after the dice ("2d10 + 25"), and `describeNeed` gives it as `roll` beside `dice` for a dice pause.
- 033d16d: A choice step over values names its values by the content the action runs for first:
  `<contentId>.options.<value>.name`, else `<actionKey>.options.<value>.name`. A pause over values
  (and its random draws) carries `needs.content`, the content's qualified ID; `text.option` takes
  `content` in its context and `describeNeed` passes it, and `pnpm validate` accepts the item's
  own value keys. One shared action's values now take per-content text (#72).

### Patch Changes

- 033d16d: A `prerequisite-not-met` on an inline option another pack added to a choice (`extendChoices`)
  reads the requirement and the option's name from the adding pack's text, found through
  `optionOrigins`, when the owner's pack has none.
- 033d16d: `too-many-copies`'s standard text names what is held too often: the type for a type's `max`
  ("Archetype: too many are held (at most 0)."), the item for a `perItem` limit with the new
  `issues.too-many-copies.item`.
- 033d16d: An error with no text of its own, or whose text misses an argument, reads as its `data.message`
  when it has one, before `errors.other`. The spec's `errors.other` no longer shows the code to a
  player ("Something went wrong."); it still gets `{code}`, and the guides say to log the code and
  data for developers.
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [f44f66c]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [f44f66c]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [033d16d]
- Updated dependencies [a26226f]
- Updated dependencies [033d16d]
  - @opencharacter/spec@0.3.0

## 0.2.0

### Minor Changes

- e25791e: `keepsTemplates` may give `content: { type, where }` to keep a template on picked or granted content without a copy, such as a spell known; `computeSheet` lists merged items as `templated`, and a block reads a merged item's tags (#19).
- 44023e4: `advantage` and `disadvantage` roll modifiers take `of: roll` to roll the whole roll again and keep the better or worse total; results gain `rolls`, a dice pause gains `repeat`, and the text gets `dice.repeat` (#34).

### Patch Changes

- Updated dependencies [44023e4]
- Updated dependencies [c860566]
- Updated dependencies [29398e1]
- Updated dependencies [44023e4]
- Updated dependencies [2c6f736]
- Updated dependencies [9999f66]
- Updated dependencies [e25791e]
- Updated dependencies [49a6ba5]
- Updated dependencies [44023e4]
- Updated dependencies [44023e4]
- Updated dependencies [7f34bf4]
- Updated dependencies [44023e4]
- Updated dependencies [8560185]
- Updated dependencies [44f9c44]
- Updated dependencies [769fe80]
  - @opencharacter/spec@0.2.0

## 0.1.1

### Patch Changes

- 03799db: Update `intl-messageformat` to 12.1.3 and `@formatjs/icu-messageformat-parser` to 3.5.21.
