# @opencharacter/wwn-srd

## 0.2.0

### Minor Changes

- 033d16d: A result band may mark its set's success threshold, `success: true`: the band a roll needs, what
  an app shows before the roll ("what you need"). A set marks at most one. The roll summary
  (`needs.summary`, a log entry's `summary`) and `text.rollTargets` carry the mark on its band; a
  pack's band condition text that needs a test's value no longer shows its raw template when the
  band has no tests. Every pack marks its banded checks, saves and attacks: the DC check's success,
  the attack's hit, Fate's `succeed` against the opposition, FitD's action roll at `partial` (a 4
  or 5 does what the player set out to do), Mothership's success and panic `pass`, Mörk Borg's test
  against the DR. Ladders, tables and fortune rolls have no threshold and mark none.
- 033d16d: Grant-only content (#172): partial classes and magic traditions are held only through picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.
- 033d16d: The Mage's and the partial Mage's traditions are content of the new type `tradition` (its `trad` key in `key`) instead of inline options, so an add-on pack's tradition is offered too; the upgrade script renames saved picks (`high-mage` → `traditions.high-mage`, and so on). `tradition.<key>.tier` counts the picked tradition (2 under a class tagged `full-mage`, else 1). Each tradition's creation bonus skill is the new field `tradition.<key>.skill`, set by the content that brings the tradition, and creation gains them in one loop instead of a step per tradition. The spell lists a caster learns from read the tradition keys (`item.list` is a `trad` key, or `high`), and the spell-casting traditions are the new family `spellTrad`, so the casting mode, the spell picks and the spell-known check follow added traditions.
- 033d16d: Open to add-on packs: committing, releasing and resting change a tradition's Effort fields and
  creation and `improve` a skill's fields through `fieldId`, so an add-on's tradition joins
  `effortTrad` and its skill the `skill` family, and both work with the core's actions. A
  background's table entries, a focus's `bonusSkill` and a weapon's `skill` are open enums.

### Patch Changes

- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).
- 033d16d: Advancement actions are available only when something is owed: `level-up` when the XP reaches
  the next level, skill improvements (`improve-skill`, `raise-skill`, `learn-technique`) when there
  are skill points or credit to spend, and attribute boosts (`improve-attribute`,
  `boost-attribute`) when the next boost is affordable at the character's level.
- 033d16d: A spell's `list` and an art's `tradition` are open to add-on packs' values. The arts and Effort checks and `arts.owed` read the `artTrad` and `effortTrad` families instead of naming each tradition, and the traditions whose arts armor stops are the new families `armorTrad` and `heavyArmorTrad`. Steps add-on packs' rules effects reach carry tags: `creation.purse`, `creation.finish`, `advancement.level`, `rest.night` and `rest.scene`.
- 153b36f: A second partial Mage isn't offered once no tradition is open (after a partial Invoker). Random starts always finish: starting gear the character couldn't carry isn't offered, and Lucky reads an attribute score of 7 or less, so Xenoblooded can't undo it.
- 033d16d: Display: the attack actions' group is "Attacks" and the advancement actions' "Level up", apart
  from the Combat and Advancement field groups; the two arts named A Thousand Tongues are named by
  tradition (Bard, Blood Priest); skill credit shows in the Advancement group.
