---
'@opencharacter/orc-2e': patch
'@opencharacter/spec': patch
---

Bless, protective wards and protector's sphere are cast on the caster, whose entry projects the
emanation as an applied aura (`scope: applied`, one per cast) for the app to place on allies
inside, instead of an entry per ally passed to the cast. Sustaining bless or protective wards to
widen it is the spell's `widen` action (a `widened` state key the aura's size reads; wards to 30
feet). The sphere's resistance by rank reaches allies through the caster's
`spells.sphereResistance`. Entries already on allies keep their effects. Conformance suite:
`orc-cast-bless-aura`, `orc-bless-widen`, `orc-bless-aura`, `orc-protectors-sphere-ally`.
