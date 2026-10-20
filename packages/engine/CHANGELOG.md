# @opencharacter/engine

## 0.1.1

### Patch Changes

- e050f92: An action step run from an inline action of content granted on a copy now runs the used rules
  action with that content as its `item` (the step's `entry` and `source`), not the copy's own item.
