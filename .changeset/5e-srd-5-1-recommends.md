---
'@opencharacter/5e-srd-5.1': patch
'@opencharacter/spec': patch
---

The guided start finishes unattended, as 5.2's does: its race, subrace, class and background recommend the first offered, and every pick creation or a level-up asks recommends one of the options it offers (`recommend` over `options`): class skills, tools, fighting styles and subclasses, languages, expertise, spells (a class's staple spells first, then the highest level offered), invocations (Agonizing Blast only with Eldritch Blast), the pact boon, Metamagic, Mystic Arcanum, the hunter's tactics, subraces and draconic ancestries, and each starting-equipment pick. An Ability Score Improvement recommends +2 to the highest ability that takes it, else +1 to two, else a feat. Conformance suite: `5e-create-guided-pauses` becomes `5e-create-guided-finishes`; `5e-create-guided-array` pauses its picks to show the hill dwarf's recommended tool; the point-buy, roll and if-proficient cases answer every pick; options cases expect the recommended option.
