# @opencharacter/5e-srd-5.1

## 0.2.0

### Minor Changes

- ff96122: Use the new format features. Death Ward holds its target at 1 hit point and ends. Eldritch Spear keeps a 300-foot range template on eldritch blast (the `eldritchBlast.range` field is gone). Arcane Recovery and Natural Recovery pick spent slots in a choice step instead of `level1`..`level5` params. The once-per-rest invocations keep `used` on their own pick, and Relentless Endurance and Infernal Legacy keep their uses on the trait, no longer on the class or race copy: the 0.1.0→0.2.0 upgrade script moves saved uses. The dragonborn breath weapon is once per short or long rest. Creation and `create-monster` pick in the copy they added.
