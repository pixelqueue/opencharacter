---
'@opencharacter/spec': minor
'@opencharacter/engine': minor
---

`countPicks` and `countGrants` nest inside another aggregate's arguments, evaluated once per outer
element with its root bound (`sumFields(countPicks(f.id in pick.fields.upgrades) > 0 ? 0 : f.value)`).
`picksOf('rules', choice)` (or `'<pack>:rules'`) reads a rules-level choice's saved picks wherever a
character is, activation conditions, constraints and display hints included; a choice the rules
don't declare is `unknown-reference` at load.
