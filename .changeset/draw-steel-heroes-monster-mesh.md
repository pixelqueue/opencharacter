---
'@opencharacter/draw-steel-heroes': minor
'@opencharacter/spec': patch
---

draw-steel-heroes: fields and rules a creature pack needs.

- A kit's damage bonus for a tier adds a part only when it's above 0, so a creature without a kit (or a kit with a 0 tier) no longer gets an untyped 0 adjust when an `op: tag` types the ability's damage.
- `powerRoll.strikeEdgesAgainstFor`: an edge on strikes for attackers whose `side` or creature ID is in the set (rule `target-side-strike-edge`). `powerRoll.edgesAgainstFor` (`target-side-edge`) now matches the attacker's creature ID too: both hold sides or creature IDs.
- `powerRoll.meleeStrikeBanesAgainst` and `powerRoll.rangedStrikeBanesAgainst`: banes on melee and on ranged strikes against the creature.
- A `flying` input field (the player or Director sets it). Wings (devil, dragon knight) give damage weakness 5 while flying at 3rd level or lower.
- The `creature` view carries `flying` and the new edge and bane fields.
- `abilities.barred`: keywords (`kw.*` tags) the creature can't use abilities with; `use-ability` isn't available for an ability with one.
- A `potencyBonus` on a target's own tier (`power-target`) raises the potency against that target.
- Conditions and effects take the durations `own-next-start` and `own-next-end` (and `own-this-turn`, an own-next-end one in that turn): until the start or the end of the holder's own next turn, ended by `turn-boundary` on that creature's turns whoever applied it, so a frightened, grabbed or taunted creature keeps its source as `appliedBy`. An ability's `t{tier}Duration` takes `own-next-start` and `own-next-end` for the target's next turn.

No saved shape changes. Conformance cases and the test-only `test-draw-steel-foe` pack show each.
