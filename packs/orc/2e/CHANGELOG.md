# @opencharacter/orc-2e

## 0.2.1

### Patch Changes

- f44f66c: Class-only display fields show only for their class: bard muse, champion and cleric sanctification, cause, doctrine, druidic order, mystery, bloodline, patron, arcane school and thesis, and Drain Bonded Item's uses. The elemental influence shows for the elemental bloodline, the evolution spells with Arcane and Occult Evolution, favored weapons with a favored rank, the familiar's weapons when it has some, and alchemical bombs when above martial weapons. Swim, fly, climb and burrow speeds show when the character has them. The cleric's and champion's sanctification are "Deity's sanctification" and "Champion's sanctification".
- f44f66c: Guided creation asks the four free attribute boosts before the class's choices, so the class's trained skills are asked once, with the count the final Intelligence gives. The random start keeps them after the class's choices, once the key attribute is known.
- f44f66c: The rogue's key attribute prerequisites are phrases, like the rest ("Ruffian racket").
- f44f66c: Less clutter on every sheet. Spell slot ranks, the extra slot and its spells show only when the character has those slots, and the divine font only for a font. A skill's proficiency rank is its modifier's companion, so the Skill proficiency group is gone, and a Lore shows only once trained. A custom Lore's subject input sits in Skills, as "Custom Lore subject (1)". Damage immunities, a weapon parry and Wave Fan activations show when they apply; the remaining helper values are hidden.

## 0.2.0

### Minor Changes

- 5e5ce95: Use the new format features. Shield, Flame Barrier, Energy Absorption, Enduring Might and the champion's reaction resistance end once they apply. Fire Shield's shield can Shield Block and is destroyed at its Hit Points. Granting content presets Assurance's skill, Additional Lore's Lore and the terrain of Terrain Expertise and Terrain Stalker. Assurance's skill is a pick now, also offering trained Lores: its `skill` state is dropped, so a saved one becomes a pending choice. Additional Lore gains Hag Lore for Changeling Lore. Terrain Scout gives its second terrain: characters with it get a pending `terrain` choice, and it can't repeat Terrain Stalker's terrain. Drain Bonded Item's `bondDrained` and `linkedFocusUsed` move from the wizard class copy to Arcane Bond's saved grant state.
