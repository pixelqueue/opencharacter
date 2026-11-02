---
'@opencharacter/orc-2e': patch
'@opencharacter/orc-sf-2e': patch
'@opencharacter/spec': patch
---

Bless, protective wards and protector's sphere project their aura only from an entry the caster
applied itself (`self.appliedBy == character.id`), so an older entry on an ally (no applier)
keeps its bonus but projects nothing. Their `widen` action is once a turn (a `sustained` state
key the caster's next turn clears) and carries the concentrate trait instead of the `spell` tag.
A reroll that keeps the better result keeps the higher total on the same degree. Conformance
suite: `orc-bless-sustain-turn-start`; `orc-bless-aura` pins an old-shape entry.
