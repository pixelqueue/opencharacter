# @opencharacter/fitd-scoundrel

## 0.3.0

### Minor Changes

- f44f66c: A project names what it teaches by reference, `learnsRitual` (a ritual) or `learnsDesign` (a design), in place of the free-text `learns`, so a custom project's lesson is checked at load and a form can offer the items. The creation starts' descriptions and the `creation-dots` text match the steps: a special ability (or a homebrew playbook's), a vice, three starting action dots (a playbook's own instead), then four more.

## 0.2.0

### Minor Changes

- 72234ec: The hidden `playbook.tag` field is gone: the special-abilities choice counts the playbook pick with `picksOf('playbook')`. Coin spent on recovery, project, heat, asset, crafting and ritual rolls is a value choice; the option IDs are now the numbers, read as `steps.coin.value`.
