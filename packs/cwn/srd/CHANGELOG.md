# @opencharacter/cwn-srd

## 0.3.0

### Minor Changes

- aae4b97: Weapons and spells declare the parameters they use (`params` effects): `attack` offers `attribute` only on Str/Dex weapons, `thrown` only on melee weapons with a range and `burst` only on burst weapons, and `cast-spell` offers `commit` only on spells that Commit for the scene or the day. Their text moves to `types.weapon.params.*` and `types.spell.params.*`.

  Apps pass `attribute`, `thrown`, `burst` and `commit` only where describeAction lists them for that weapon or spell (one passed where describeAction doesn't list it is ignored), and read their names from `types.weapon.params.*` and `types.spell.params.*` instead of the actions' own param keys.

### Patch Changes

- aae4b97: Armor, dermal plating and Skin of Steel set both base Armor Classes from one source: their `set` effects share the `base-ac` stack key, which spans `ac.ranged.base` and `ac.melee.base` (`playerChooses`, the best pair recommended). A medium armored suit (18/14) with Dermal Armor I (16/16) no longer mixes into 18/16.

  App state: the competing groups on `ac.ranged.base` and `ac.melee.base` are now one `base-ac` group spanning both fields, with one option per source, so a pick an app saved for the old per-field groups has to be made again.

- aae4b97: Prodigy's attribute, Specialist's skill, a skillplug's skill and All Natural's attributes recommend an option (`recommend: options[0]`; All Natural the first attribute still under +3), so a guided level-up over All Natural's later picks finishes instead of pausing.
- aae4b97: Healer's extra Heal die no longer adds to a Heal Specialist's: the larger pool applies. The pack's `skill-dice` stack key, which never grouped pool dice, is gone.
- aae4b97: Martial Instinct spends its bonus roll itself, through a `changes` effect on the attack's new `attack.rolled` step, instead of the shared `attack` action doing it for the art.
- 769efe5: A Neural Buffer's phantom hit points refresh: the buffer has an hourly action ("An hour passes") that refreshes them, and a night's rest does too. Before, `bufferUsed` never reset.
- ca525b4: README: the quick start passes `policy`; more tagged steps listed; burst, thrown and skill-dice notes; Martial Instinct named as modeled; sections renamed and reordered.
- 44a8809: Healer's and a Specialist's extra dice share the `skill-dice` stack key (`highestOnly`) in place of Healer's guard on Heal Specialist picks: the larger pool still applies, now by the pool dice stacking rule.
- aae4b97: Spells that deal damage per level (Arson, Blast, Blastwave, Disrupt, Paralysis, Slow, Stun, Stunwave) compute it at the caster's level, and the Kill and Stun Verbs at the hacker's Program level (`damage`, such as `3d6`); Heal Injury computes its healing (`healing`, such as `1d6+1`); Skin of Steel computes its Armor Class (`ac`). Their descriptions show the value on a held copy (`{self_damage}`, `{self_healing}`, `{self_ac}`).
- aae4b97: Spells count their casts in the scene (`sceneCasts` state, reset by `end-scene` and `rest`): Blast adds one System Strain after its first cast in a scene, Blastwave one on every cast, and a second Stun in a scene Commits Effort for the day. `cast-spell` has new tagged steps `spell.effort` and `spell.cast` for such costs.
- 44a8809: Veteran's Luck is modeled. Once a scene (`scene.veteransLuck`, cleared by `end-scene` and `rest`) it turns a missed attack into a hit, an option on the attack's new `missed-attack` choice step (reached only when the attack misses a known AC and the edge's luck is unspent; recommended: keep the miss), or a hit against the character into a miss: the `veteransLuck` situational choice, selected on a weapon hit's damage (`damage.weapon`), takes the attack's batch to no damage without spending Damage Soak, deck Shielding or a Neural Buffer.
- aae4b97: Weapon copies compute their hit bonus, damage bonus and Shock as an attack with them starts (`hit`, `damage`, `shock`, with `attributeMod`, `skillLevel`, `skillDamage` and `ranged`), and drone copies their pilot's `attackBonus`. The weapon and drone blocks show them.

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
- 033d16d: Open to add-on packs: skills. The core's changes name a skill's fields through `fieldId`, so an
  add-on's skill (added to the `skill` family) is gained and raised by the core's actions, and a
  background's entries, a Focus's and an Edge's bonus skills, a weapon's `skill` and the
  `gain-skill` and `improve-skill` parameters are open enums.
- 033d16d: Grant-only content (#172): backgrounds, edges and spirit powers are held only through their picks; `addItem` of one is `not-addable`, and apps leave them out of add-item catalogs.

### Patch Changes

- 033d16d: Open to add-on packs' values: cyberware `category`, a program's `subjectType`, a drone's `moveKind` and a spell's `duration`. Steps add-on packs' rules effects reach carry tags: `creation.item` (the free starting item's kind), `creation.gear`, `creation.finish`, `advancement.level`, `rest.night` and `rest.scene`.
- 033d16d: All Natural's exclusions read the new tag `bars-cyber` instead of its ID, so an add-on pack's Focus or Edge tagged `bars-cyber` bars cyberware-bringing picks the same way. The README notes how add-on content joins creation.
- 153b36f: `gain-edge` finishes `closed` for the 5th-level Edge below 5th level and for the Underdog Edge without the rule. `attributes.modTotal` sums the modifiers of the rolled scores, so the Underdog bonus Edge can't undo its own eligibility and every random start finishes. `end-scene`, `rest`, `first-aid`, `reload`, `use-drug`, `gain-attribute`, `trigger-cyber`, `acquire-wired-cyber`, `acquire-focus-gear` and `summon-spirit` end with a declared result. Martial Instinct's counters show only for characters who have it, and the committed Effort tiles have short labels.
- 033d16d: Gaining an Edge reads the rules' Edge choices with `picksOf(choice)`.
- 033d16d: `gain-focus` is available only when the level owes a Focus level, and `gain-edge` only while an
  Edge slot is open (it ends `closed` for a slot already taken). The helpers `gain-skill`,
  `gain-attribute` and `acquire-wired-cyber` are no longer listed: creation, level-up and the Edges
  and Foci that grant them run them.
- 033d16d: A spirit's summoning cost counts the core spirit's `powers` picks, and for any other spirit the
  new `powerCount` item field (default 0), so a homebrew spirit with or without powers computes its
  cost instead of failing with `no-such-key`.
- 033d16d: Display: the action groups are named apart from the field groups: "Level up", "Programs" and
  "Spells and spirits" beside Advancement, Hacking and Magic.
- 033d16d: READMEs: each pack's install section says which spec and engine it needs, and its add-on section
  gives the text key an add-on writes to name what it adds (through `enumOrigins`,
  `optionOrigins` or `familyOrigins`).
- 033d16d: Advancement actions are available only when something is owed: `level-up` when the XP reaches
  the next level, skill improvements (`improve-skill`, `raise-skill`, `learn-technique`) when there
  are skill points or credit to spend, and attribute boosts (`improve-attribute`,
  `boost-attribute`) when the next boost is affordable at the character's level.
- 033d16d: Name text for every state key: AWN's focus `level`, weapon `shots`, mutation `origin` and
  negative mutation `light` (and the weapon's computed values), CWN's Neural Buffer `bufferUsed`,
  Godbound's gift `artifactEffort`.
