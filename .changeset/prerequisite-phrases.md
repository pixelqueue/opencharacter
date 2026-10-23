---
'@opencharacter/spec': minor
'@opencharacter/text': minor
---

Prerequisite text is a phrase, the requirement alone ("Scout Dedication"); the new standard text `issues.prerequisite-not-met.owner` (`{owner} requires: {requirement}`) names its owner. `text.issue` wraps a pack's prerequisite text with the owner's name, content or inline option, and `keys.issueKey` finds an inline option's prerequisite text (`<item>.choices.<choice>.options.<option>.prerequisites.<id>`). `pnpm validate` warns on prerequisite text that ends with a period or starts with "Requires" or "Needs".
