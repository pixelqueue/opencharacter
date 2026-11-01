---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Content items may declare `auras`: areas whose effects are on whoever is inside (`{ id, when?,
size?, affects?, fields?, effects }`). computeSheet lists the auras the character projects now
(`auras`: `{ source, aura, entry?, size?, affects }`); the app applies the aura's entry to each
creature inside (`applyEffect` with `aura` and `appliedBy`) and removes it as they leave. An aura
entry runs only its aura's effects (none of its source's rules for the holder: effects, grants,
actions, prerequisites, immunities, standard copies, kept templates) and is one per applier;
they read the holder's live values as `applier.<field>` from
the view the app passes in the new `appliers` input of computeSheet, listOptions, applyChanges,
startAction and describeAction (declared defaults without one; a paused action keeps them; a
repeated view `id` is `duplicate-id`). A repeated aura ID or an aura effect on its holder is
`invalid-aura` at load, a declared field the item's pack lacks or types otherwise
`link-field-mismatch`; an unknown `aura` is `unknown-id`. `appliedBy` is a reserved state key
name (#188).
