# @opencharacter/orc-sf-2e

## 0.2.1

### Patch Changes

- f44f66c: Guided creation asks the four free attribute boosts before the class's choices, so the class's trained skills are asked once, with the count the final Intelligence gives. The random start keeps them after the class's choices, once the key attribute is known.
- f44f66c: Add the headline: the level once a class is picked, the ancestry and the class ("Level 1 Vesk Soldier").
- f44f66c: Drop the Afflictions group: the pack has no afflictions. The affliction type stays for homebrew.
- f44f66c: Less clutter on every sheet. Spell slot ranks, the extra slot and its spells show only when the character has those slots. A skill's proficiency rank is its modifier's companion, so the Skill proficiency group is gone. A custom Lore's subject input sits in Skills, as "Custom Lore subject (1)". Gun, solar, agile melee and familiar weapon proficiencies, damage immunities, a weapon parry and implanted augmentations show in their groups when they apply; the remaining helper values are hidden.
- f44f66c: Swim, fly, climb and burrow speeds show only when the character has them.

## 0.2.0

### Minor Changes

- 4fd78cc: Use the new format features. Assurance takes its skill as a pick (Lore skills included), preset by the grants that name it: Raised by Belief's divine skill, From the Shadows, Core Memories, Effortless Influencer's three skills and Fixation's topic. Assurance's `skill` state is dropped. The ancestry Lore feats and Extra Devotion grant Additional Lore preset. Fixation's saved Lore becomes its `topic` pick. Warblood Vesk presets two Brutal Anatomy grants: its saved attack becomes the first of its `attacks`, and the second is a pending choice. The modular and Re-Forge Solar Weapon steps and Core Memories offer value lists. Shield ends when it blocks.

## 0.1.1

### Patch Changes

- 37490f5: First npm release (0.1.0 could not be published).
