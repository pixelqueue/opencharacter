---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
'@opencharacter/text': minor
---

Open enums reach action parameters, items' own state and view fields: `open: true` on a rules action's or an item's inline action's parameter, or on a state key an item declares, takes values from dependent packs' `extendEnums` (`<pack>:actions.<action>.params.<param>`, `<pack>:<item>.actions.<action>.params.<param>`, `<pack>:<item>.state.<key>`), checked by `startAction`, changes and `pnpm validate`; closing one is `enum-closed`. A declared view field marked `open: true` follows the open enum field of its ID, so a participant's or linked character's view may hold an added value. The ruleset's `familyOrigins` names the pack that added each family value; `createText` takes it (and names added parameter and item state values through `enumOrigins`), so a core values step over a family names an add-on's key from the add-on's text.
