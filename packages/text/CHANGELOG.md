# @opencharacter/text

## 0.3.0

### Minor Changes

- a26226f: Prerequisite text is a phrase, the requirement alone ("Scout Dedication"); the new standard text `issues.prerequisite-not-met.owner` (`{owner} requires: {requirement}`) names its owner. `text.issue` wraps a pack's prerequisite text with the owner's name, content or inline option, and `keys.issueKey` finds an inline option's prerequisite text (`<item>.choices.<choice>.options.<option>.prerequisites.<id>`). `pnpm validate` warns on prerequisite text that ends with a period or starts with "Requires" or "Needs".
- a26226f: Standard text by an error's data: `errors.out-of-range.min` and `errors.out-of-range.max` for an `out-of-range` with only one bound, and `errors.safety-limit-exceeded.<limit>` for each safety limit. `text.error` and `text.issue` use them, and show `errors.other` instead of the raw template when a message misses an argument. The `safety-limit-exceeded` and `out-of-range` descriptions in `error-codes.json` say what their data holds.
- a26226f: `text.roll(items, repeat?)` words a whole roll, the flat items' sum after the dice ("2d10 + 25"), and `describeNeed` gives it as `roll` beside `dice` for a dice pause.

### Patch Changes

- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [f44f66c]
- Updated dependencies [f44f66c]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
- Updated dependencies [a26226f]
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
