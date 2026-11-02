---
'@opencharacter/orc-2e': minor
'@opencharacter/orc-sf-2e': minor
---

A spell whose caster picks its damage type or battle form declares the choice as a parameter of
its own cast (a `params` effect on the new `spell-cast` tag, which only `cast-spell` carries), so
`cast-spell` keeps taking `damageType` and `form` by the same names as before, but each spell
offers only the types or forms it names: resist energy's `damageType` is acid, cold,
electricity, fire or sonic, animal form's `form` one of its nine animals, and a spell that names
none takes neither (breaking: values a spell doesn't name are refused, and `form` is an enum, not
a free string). A staff's `prepare-staff` takes neither. The spell type's `damageTypeChoice` field
is gone (breaking: an item field removed). Elemental toss and elemental blast deal the elemental
influence's type; dragon breath and flurry of claws the draconic exemplar's tradition's, unless
the cast names one. Saved characters are unchanged: the applied spell keeps its `damageType` and
`form` state.
