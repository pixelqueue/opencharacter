# @opencharacter/mothership-1e

## 0.2.0

### Minor Changes

- f44f66c: Taking the class loadout at creation sets the new input field `loadout.owed` ("Class loadout owed") on the sheet instead of returning `loadout` as outcome data, so an app or a gear pack knows the loadout is still to be added. The random start draws each skill pick over the eligible skills instead of always the first.

### Patch Changes

- f44f66c: Skill prerequisite texts name only the requirement ("Botany or Geology"), with no "Requires" and no period, for the standard text to wrap with the skill's name.

## 0.1.1

### Patch Changes

- 72234ec: Shore leave at an X-class port rolls the conversion with `advantage, of: roll` instead of a second roll step, and `roll-character` finds the new class copy through `steps.class.added` instead of a fixed instance ID.
