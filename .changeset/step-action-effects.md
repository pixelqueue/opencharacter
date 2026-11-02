---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

A new effect operation, `action`, on a tagged changes step (`target: { steps: [<tag>] }`) runs a
rules action there, as an `action` step would, after the step's changes: `{ id, use, params?,
participants?, each?, as?, changes?, to? }`. Per participant of `each` (the current one in an
`each` step), and with `as: participant` handed off, so a feature adds the target's saving throw
to a shared attack; each effect runs its own, so one hit carries two saves at their own DCs. Its
`changes` follow and read the run's outcome as `run` (a new formula root, also substituted in
formulas a change passes on). The run's path is `<step path>/<content id>#<id>`, `[<i>]` per
participant. Field IDs may no longer start with `run` (#228).
