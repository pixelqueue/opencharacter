---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

Choices whose picks wake on a condition or come as copies (#196). `activeWhen` on a choice, an
activation condition, keeps its picks saved and counted while it fails, but neither activated
nor applied (its `effects` don't run either); computeSheet's choice list marks the choice
`inactive: true`. `addAs: copy` on a content choice holds each pick as a copy of its own:
`choose` adds the copy as `addItem` would (under the option's derived ID, or the next free one)
and saves its instance ID on the pick (`entry`, a new optional key of a saved pick); removing the
pick, or what holds it, removes the copy, and `removeItem` of the copy is the new runtime error
`picked-copy` (data: `entry`, `path`; standard text in `i18n/en.yaml`). The pick itself activates
nothing, so the item applies once, through its copy; `listOptions` checks its prerequisites as
that copy's. `pnpm validate` reports `addAs` on a choice of values or inline options.
