# @opencharacter/5e-srd-5.2

## 0.2.0

### Minor Changes

- 5c4a76c: Use the new format features. Death Ward, Oil, Hypnotic Pattern and Eyebite's sleep end themselves. Multiattacks take a `charged` param for the charging attack. The Half-Dragon's Multiattack runs its Draconic damage. Eldritch Spear and Improved Elemental Fury extend the cantrip's range. Sibling picks are read with `picksOf`: the `origins.backgroundPlusTwo`, `origins.cantripReplaced`, `warlock.pactWeapons` and `warlock.lessons` fields are gone. The smite slot level and Lesser Restoration's condition are choice steps over values. Backgrounds preset Magic Initiate's list, and its `list` state is gone. Species traits and Gift of the Depths keep their own uses, moved off the species and Warlock copies by the 0.1.1→0.2.0 upgrade script. Giant Ancestry does too, with Stone's Endurance spending from its `then`.

## 0.1.1

### Patch Changes

- 37490f5: First npm release (0.1.0 could not be published).
