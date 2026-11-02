---
'@opencharacter/5e-srd-5.2': patch
'@opencharacter/spec': patch
---

Every pick a guided start or a level-up asks recommends one of the options it offers (`recommend` over `options`), so an automatic run of either start, or of a level-up to 20, finishes for every class: class skills, tools and subclasses, background and feature languages, expertise, spells (a class's staple spells first, then the highest level offered; the old lists ran out on later levels), invocations (only ones whose level prerequisite the warlock meets), Mystic Arcanum, Metamagic, Signature Spells and Spell Mastery, the species lineages and the other feature options. Recommendations that read `choice.picks` now read `options` (weapon masteries, Keen Senses, Skillful, the fighting-style cantrips). Conformance suite: `5e52-create-guided-recommended` and `5e52-create-higher-level` finish with no answers, `5e52-create-guided-pauses` is gone, and `5e52-level-up-warlock-auto` levels a warlock to 2 with no answers.
