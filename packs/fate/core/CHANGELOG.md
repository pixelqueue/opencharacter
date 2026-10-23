# @opencharacter/fate-core

## 0.1.2

### Patch Changes

- f44f66c: Turn-order sort keys are hidden, and the Conflict group they filled is gone. The `teamwork` situational choice is removed: helpers count once, through `helper` participants or `skill-roll`'s `helpers` parameter. A consequence without words is reported (`consequence-label`).

## 0.1.1

### Patch Changes

- 72234ec: Number picks are value choices (`options: { values }`): how many aspects `skill-roll` invokes (paid and free), which stress box `take-hit` checks, and how many extra stunts creation buys. The steps read `steps.<id>.value`; their option IDs are now the numbers.
