# @opencharacter/mork-borg-core

## 0.2.0

### Minor Changes

- f44f66c: `create-character` puts the starting equipment on the sheet: the waterskin and d4 days of food, and what the three equipment tables give, as copies of the pack's scrolls, decoctions and shield or of the new `equipment` type (names only, with the tables' numbers; counted by `load.items` unless a beast or vehicle). The tables are rolled before the weapon and armor, so a classless character with a scroll from them gets the smaller dice: the `scroll` parameter is gone, and the outcome no longer carries the rolls as data. The classless start draws its two 4d6 abilities at random instead of always Strength and Agility.

## 0.1.1

### Patch Changes

- 72234ec: Creation no longer gives the class and companion copies fixed instance IDs: it asks the new class's features through `steps.class.added`, and getting better finds the Gutterborn Scum's copy with a copies choice. The Herbmaster's dose split is a value choice, and creation and brewing name their weapons, armor, ammunition, scrolls and decoctions with `@` refs instead of building ID strings.
