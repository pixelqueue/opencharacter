# @opencharacter/fitd-scoundrel

## 0.3.1

### Patch Changes

- 769efe5: The guided start recommends every pick, so run automatically it finishes: each dot of the starting, heritage, background and free allocations goes to the first action with room in an order that alternates the attributes (Hunt, Finesse, Attune, Study, …), and a pending choice takes its first option.
- ca525b4: README: sections reordered, Out of scope is now Limitations; Expertise's card names the chosen action.
- 847d025: fitd-crew and fitd-scoundrel: the READMEs describe the crew as the reference shared sheet (every member links one crew file; apply each member's heat as its own batch and recompute the crew before the next). fitd-scoundrel: Expertise computes the chosen action's rating (`action`, a computed value on the picked ability), and its card names it. No saved shape changes. Conformance case for the card value.

## 0.3.0

### Minor Changes

- 033d16d: A result band may mark its set's success threshold, `success: true`: the band a roll needs, what
  an app shows before the roll ("what you need"). A set marks at most one. The roll summary
  (`needs.summary`, a log entry's `summary`) and `text.rollTargets` carry the mark on its band; a
  pack's band condition text that needs a test's value no longer shows its raw template when the
  band has no tests. Every pack marks its banded checks, saves and attacks: the DC check's success,
  the attack's hit, Fate's `succeed` against the opposition, FitD's action roll at `partial` (a 4
  or 5 does what the player set out to do), Mothership's success and panic `pass`, Mörk Borg's test
  against the DR. Ladders, tables and fortune rolls have no threshold and mark none.
- 033d16d: Open to add-on packs: a gear item's `kind` is an open enum, and creation's playbook, special
  ability, vice and pending picks (`creation.playbook`, `creation.ability`, `creation.vice`,
  `creation.picks`) and its last step (`creation.finish`) carry tags for an add-on's options and
  changes.
- 033d16d: The hidden `expertise.action` field is gone: a group action's leader reads the Expertise pick itself (`picksOf`), so two Expertise picks both count.
- f44f66c: A project names what it teaches by reference, `learnsRitual` (a ritual) or `learnsDesign` (a design), in place of the free-text `learns`, so a custom project's lesson is checked at load and a form can offer the items. The creation starts' descriptions and the `creation-dots` text match the steps: a special ability (or a homebrew playbook's), a vice, three starting action dots (a playbook's own instead), then four more.
- 033d16d: Grant-only content (#172): playbooks, special abilities, vices and trauma conditions are held only through their picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.

### Patch Changes

- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).

## 0.2.0

### Minor Changes

- 72234ec: The hidden `playbook.tag` field is gone: the special-abilities choice counts the playbook pick with `picksOf('playbook')`. Coin spent on recovery, project, heat, asset, crafting and ritual rolls is a value choice; the option IDs are now the numbers, read as `steps.coin.value`.
