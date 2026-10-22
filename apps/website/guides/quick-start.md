# Quick start

This page loads the 5E SRD pack, computes a character's sheet, changes the character and
rolls an attack. The other guides explain each step in depth.

## Install

```sh
npm install @opencharacter/engine @opencharacter/5e-srd-5.1
```

- `@opencharacter/engine` is the TypeScript reference engine. It has no runtime dependencies
  on Node, so it runs in browsers, servers and workers. It ships as ES modules with type
  declarations, for Node 22 and later and current browsers.
- `@opencharacter/5e-srd-5.1` is one content pack: its rules, content and English text.

## Load, compute, change, roll

```ts
import {
  applyChanges,
  computeSheet,
  loadRuleset,
  SPEC_VERSION,
  startAction,
} from '@opencharacter/engine';
import type { CharacterFile } from '@opencharacter/engine';
import srd from '@opencharacter/5e-srd-5.1';
import en from '@opencharacter/5e-srd-5.1/i18n/en';

// 1. Load the packs into a ruleset. Do this once and keep the result.
const loaded = loadRuleset([srd]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { ruleset } = loaded;

// 2. A character file holds only base state: inputs, owned items, picks. The CharacterFile type
//    catches a misspelled or missing property before anything runs.
let character: CharacterFile = {
  specVersion: SPEC_VERSION,
  id: 'quick-start',
  packs: [{ id: '5e-srd-5.1', version: '0.1.0' }],
  values: {
    '5e-srd-5.1:abilities.str.base': 16,
    '5e-srd-5.1:abilities.dex.base': 12,
  },
  inventory: [{ id: 'sword', item: '5e-srd-5.1:weapons.longsword', equipped: true }],
};

// 3. Compute the sheet. Every value is derived here, never saved.
const sheet = computeSheet(ruleset, character);
const mod = sheet.values['5e-srd-5.1:abilities.str.mod'];
console.log(en['fields.abilities.str.mod.name'], mod?.value); // Strength modifier 3

// 4. Change the character through the engine, never by editing the file.
const result = applyChanges(ruleset, character, [
  { type: 'set', field: '5e-srd-5.1:abilities.str.base', value: 18 },
]);
if (!result.ok) throw new Error(JSON.stringify(result.errors));
character = result.character; // save this

// 5. Roll an attack with the sword. The engine rolls the dice itself by default.
const attack = startAction(ruleset, character, {
  action: { id: '5e-srd-5.1:weapon-attack', entry: 'sword' },
  params: { targetAc: 13 },
});
if ('status' in attack && attack.status === 'finished') {
  console.log(attack.outcome); // e.g. { result: 'hit', data: { critical: false, attack: 17 } }
  console.log(attack.proposedChanges); // damage for the target, for your app to apply
}
```

What happened:

1. **`loadRuleset`** merged the pack, resolved every reference and checked every formula. The
   ruleset is plain JSON; cache it.
2. **The character** is a plain object in the
   [character file format](../../../packages/spec/docs/characters.md). Every ID in it is qualified
   with its pack (`5e-srd-5.1:…`).
3. **`computeSheet`** returned the Strength modifier (and every other value) with a breakdown of
   where it came from. It also listed the actions the character can take now, including
   `weapon-attack` on the equipped sword.
4. **`applyChanges`** returned a new character. It never changes the one you pass in, so the old
   one is still there for undo.
5. **`startAction`** built the attack roll, rolled it, decided hit or miss and proposed damage
   for the target. Applying the damage is up to your app ([Other characters](other-characters.md)).

The text came from the pack's English file, by key. The engine never returns display text
([Text and translation](text-and-translation.md)).

## Test data

The example characters in [`examples/characters/`](../../../examples/characters/) are good test
data: `5e-tamsin.yaml` exercises effects, templates, competing options and Bless, and
`5e-goblin.yaml` is a monster.

## Next

- [Implementing OCF](implementing.md): how much of OCF your app needs, and where the engine
  runs.
- [Packs and rulesets](packs-and-rulesets.md): getting packs and loading them properly.
- [Storing characters](storing-characters.md): what to save and how.
