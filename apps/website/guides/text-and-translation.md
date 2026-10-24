# Text and translation

**The engine never returns display text.** It returns IDs, keys, codes and data, and your app
turns them into text in the player's language. This page explains the keys; the
[Showing text](showing-text.md) helper builds them for you. That's what lets one engine serve every language,
and it lets packs keep rules text separate from mechanics.

## Where text lives

Each pack has one message file per language: a flat map from key to an
[ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/) message.

```yaml
# 5e-srd-5.1, English
fields.combat.ac.name: 'Armor Class'
fields.combat.ac.short: 'AC'
armor.shield.name: 'Shield'
magic-items.weapon-plus-one.name: '{base} +1'
constraints.attunement-limit: 'A creature can be attuned to at most {limit} magic items (currently {attuned}).'
```

- The pack's **default language** ships with the pack (`@opencharacter/5e-srd-5.1/i18n/en`).
- **Other languages** ship in the pack's `-i18n` package (`@opencharacter/5e-srd-5.1-i18n/de`).
  Translation fixes don't change the pack's version, so characters never see "update available"
  for a typo.
- Every language is its own entry point. Import only the ones you show, or load them on demand:

  ```ts
  import en from '@opencharacter/5e-srd-5.1/i18n/en';
  const de = await import('@opencharacter/5e-srd-5.1-i18n/de');
  ```

- **Text isn't pinned.** Keys are permanent, so the latest translations work with any version of
  the pack. Load the newest language files you have.
- **Fallback:** when a key is missing in the player's language, use the pack's default language.
  The default-language file has every required key; other languages may be partial.
- Some packs have no rules text on purpose. A `mechanics-only` pack (Mothership) has names and
  neutral labels only, and its descriptions are for players or licensed packs to supply.

Keep messages **per pack**: keys are local to their pack, so two packs can both have
`fields.hp.max.name`.

```ts
type Messages = Record<string, string>;
const text: Record<string, Messages[]> = {
  // pack ID → message files, player's language first, default language last
  '5e-srd-5.1': [de, en],
};

function message(pack: string, key: string): string | undefined {
  for (const messages of text[pack] ?? []) if (key in messages) return messages[key];
  return undefined;
}
```

## From an ID to a key

The engine hands you **qualified IDs** (`5e-srd-5.1:armor.shield`). Split off the pack, then
build the key from the local part:

```ts
function split(qid: string): [pack: string, local: string] {
  const i = qid.indexOf(':');
  return [qid.slice(0, i), qid.slice(i + 1)];
}

const contentName = (qid: string) => {
  const [pack, local] = split(qid);
  return message(pack, `${local}.name`); // armor.shield.name → Shield
};

const fieldName = (qid: string) => {
  const [pack, local] = split(qid);
  return message(pack, `fields.${local}.name`); // fields.combat.ac.name → Armor Class
};

function actionName(qid: string) {
  const [pack, local] = split(qid);
  const hash = local.indexOf('#'); // an action defined on an item: <item>#<action>
  return hash < 0
    ? message(pack, `actions.${local}.name`)
    : message(pack, `${local.slice(0, hash)}.actions.${local.slice(hash + 1)}.name`);
}
```

The key conventions ([Translation](../../../packages/spec/docs/i18n.md#key-conventions)):

| What                        | The engine gives you                                      | Key, in the ID's pack                                                |
| --------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| The pack                    | `pack.id`                                                 | `pack.name`                                                          |
| A content item              | `5e-srd-5.1:armor.shield`                                 | `armor.shield.name`, `armor.shield.description`                      |
| A field                     | `5e-srd-5.1:combat.ac`                                    | `fields.combat.ac.name`, `fields.combat.ac.short`                    |
| A content type              | `5e-srd-5.1:weapon`                                       | `types.weapon.name`                                                  |
| A display group             | group `combat` (with its `pack`)                          | `groups.combat.label`                                                |
| A rules action              | `5e-srd-5.1:weapon-attack`                                | `actions.weapon-attack.name`                                         |
| An action on an item        | `5e-srd-5.1:features.fighter.second-wind#second-wind`     | `features.fighter.second-wind.actions.second-wind.name`              |
| An action's choice option   | option `hit` of `weapon-attack`                           | `actions.weapon-attack.options.hit.name`                             |
| An action's choice question | `needs` `{ action, step: 'hit/confirm' }`                 | `actions.weapon-attack.steps.confirm.prompt`                         |
| An action's roll (optional) | `needs` or log `{ action, step: 'damage' }`               | `actions.weapon-attack.steps.damage.name`                            |
| An action's parameter       | parameter `targetAc` of `weapon-attack`                   | `actions.weapon-attack.params.targetAc.name`                         |
| An action's result          | `outcome.result: hit` of `weapon-attack`                  | `actions.weapon-attack.results.hit.name`                             |
| Longer text (optional)      | an action, a field                                        | `actions.weapon-attack.description`, `fields.hp.current.description` |
| A situational choice        | `5e-srd-5.1:advantage`                                    | `situational.advantage.name`                                         |
| A result band               | log `band: success`, `bandSet: …:action`                  | `bands.action.success.name`                                          |
| A named text (optional)     | a spell's type declares `texts: [material, trigger]`      | `spells.shield.texts.trigger`                                        |
| A copy's value (optional)   | a cohort's computed `quality`, its state `harm`           | `types.cohort.computed.quality.name`, `types.cohort.state.harm.name` |
| A tag (optional)            | tag `finesse` on a weapon                                 | `tags.finesse.name`, `tags.finesse.description`                      |
| A card header (optional)    | a spell, `5e-srd-5.1:spells.fire-bolt`                    | `spells.fire-bolt.block`, else `types.spell.block`                   |
| An enum value (optional)    | a spell's `school: evocation`                             | `types.spell.fields.school.values.evocation.name`                    |
| The headline (optional)     | the character, "Level 3 Hill dwarf Wizard"                | `headline`; a member's piece `types.class.headline`                  |
| A choice on content         | path `{ entry, choice: ['fighting-style'] }` on a fighter | `classes.fighter.choices.fighting-style.prompt`                      |
| A rules-level choice        | path `{ choice: ['playbook'] }`                           | `rules.choices.playbook.prompt`                                      |
| A prerequisite (issue `id`) | `5e-srd-5.1:classes.fighter/multiclass`                   | `classes.fighter.prerequisites.multiclass`                           |
| A constraint (issue `id`)   | `5e-srd-5.1:attunement-limit`                             | `constraints.attunement-limit`                                       |

Some details:

- **Display hints can override keys.** A field hint's `label` or `shortLabel`, and a group's
  `label`, name a different key in the same pack. Use it when present.
- **Choice prompts belong to the choice's owner.** In a path, the owner of a choice is the
  option just before it, or the entry's item when the choice comes first, or the rules when there
  is no entry. In `{ choice: ['playbook', 'homebrew:playbooks.bruiser', 'special-ability'] }`
  the owner of `special-ability` is the Bruiser, a table's own playbook, so the key is
  `playbooks.bruiser.choices.special-ability.prompt` in its homebrew text. A choice ID with a slash names its owner
  itself: `5e-srd-5.1:features.wizard.spellcasting/cantrips` (a choice of granted content) is
  `features.wizard.spellcasting.choices.cantrips.prompt`. A rules-level choice's ID in a path is bare;
  find its pack from `ruleset.rules.choices`, whose keys are qualified.
- **Result bands:** the log entry of a roll gives the band ID (`band`) and the band set's
  qualified ID (`bandSet`); the key is in the set's pack.
- **Descriptions are Markdown** (CommonMark with GFM tables, never HTML). Render them, or show
  them as plain text. Every other message is plain text.
- **Named texts** are extra text a content type declares (`texts` in `ruleset.contentTypes`):
  5E spells have `material` (the material component) and `trigger` (a reaction's trigger), for
  the spell's header. An item may have none.
- **Blocks** are an item's card header, an ICU template over its fields in Markdown
  ([Translation](../../../packages/spec/docs/i18n.md#blocks)): show the block, then the
  description. Fill one with the item's fields by name, `{<field>_name}` the value's name,
  `{has_<field>}` whether it has one, `{texts_<text>}` and `{self_<key>}` a copy's state;
  `@opencharacter/text` does it for you ([Showing text](showing-text.md#content-cards)).
- **The headline** is a one-line description of the character, the pack's `headline` template
  ([Translation](../../../packages/spec/docs/i18n.md#headlines)): show it under the
  character's name, and the pack's name when the pack has none or it words nothing yet.
  `@opencharacter/text` fills it ([Showing text](showing-text.md#headlines)).
- **Tags** may have a name and a description in the pack that declares them (5E's weapon
  properties). A tag without a name is for the rules, not for players.
- **Steps of an action belong to the action that defines them.** A pause and each log entry give
  `action` (the defining action's ID) and `step` (a path). Build the step's keys from `action` and
  the path's last segment: a nested panic check's pause is `step: 'panic/panic'`,
  `action: 'mothership-1e:panic-check'`, so its keys start with `actions.panic-check.steps.panic`.
- **Action results:** an action's `results` (in `ruleset.rules.actions[id]`) lists its results,
  each named `<action key>.results.<result>.name`; `results: { bands: <set> }` means the results
  are that set's bands, named like any band. A step's `prompt` or `label`, or a parameter's
  `label`, overrides the default key.
- **Hidden fields** have no names. Don't show them.

### Templated names

A template's name includes its base item's name as the ICU argument `{base}`:
`magic-items.weapon-plus-one.name: '{base} +1'`. For a copy with templates, format each template's
name in turn, starting with the base item's:

```ts
function copyName(entry: { item: string; templates?: string[] }) {
  let name = contentName(entry.item) ?? entry.item;
  for (const t of entry.templates ?? []) name = format(templateMessage(t), { base: name });
  return name; // Longsword +1
}
```

Use an ICU MessageFormat library to format messages: `intl-messageformat` in JavaScript, and ICU
libraries exist for most other languages. Messages also use plurals
(`{count, plural, one {# charge} other {# charges}}`).

## Errors and issues

Error and rules-issue **codes** are defined by the spec, not by packs, and the spec ships English
text for each of them ([source](../../../packages/spec/i18n/en.yaml)). Import it as you import a
pack's default language, a flat map of keys to messages:

```ts
import specText from '@opencharacter/spec/i18n/en'; // or the JSON: dist/i18n/en.json
```

```yaml
errors.wrong-type: '"{target}" needs a value of type {expected}.'
errors.not-owned: 'The character does not have "{entry}".'
issues.too-many-picks: 'Too many options are picked (at most {max}).'
issues.prerequisite-not-met: 'A requirement is not met.'
issues.prerequisite-not-met.owner: '{owner} requires: {requirement}'
```

Fill the placeholders from the error's or issue's `data`. For example:

```json
{
  "code": "wrong-type",
  "path": "/changes/0",
  "data": { "target": "5e-srd-5.1:abilities.str.base", "expected": "a whole number" }
}
```

`target` is a field ID here, so a good message replaces it with the field's name before
formatting.

A few codes have text by their data: `out-of-range` with only a `min` or a `max` uses
`errors.out-of-range.min` or `.max`, and `safety-limit-exceeded` uses
`errors.safety-limit-exceeded.<limit>` when there is one. If a code has no text, or its message
still misses an argument, show the error's `data.message` when it has one, else `errors.other`,
rather than the template. `errors.other` gets `{ code }`, but the spec's English leaves it out:
a code means nothing to a player, so log `code`, `path` and `data` for developers instead.

**Prefer the pack's text for an issue when there is one.** `prerequisite-not-met` and
`constraint-failed` carry an `id`, and the pack has a specific message for it (the keys in the
table above). The spec's generic text is the fallback:

```ts
function issueText(issue: { code: string; id?: string; data?: Record<string, unknown> }) {
  if (issue.id && issue.code === 'prerequisite-not-met') {
    const [pack, local] = split(issue.id);
    const [owner, prerequisite] = local.split('/');
    const own = message(pack, `${owner}.prerequisites.${prerequisite}`);
    // The pack's text is the requirement alone; the spec's text names the owner.
    if (own)
      return format(specText['issues.prerequisite-not-met.owner'], {
        owner: message(pack, `${owner}.name`) ?? owner,
        requirement: own,
      }); // Terrain Scout requires: Scout Dedication
  }
  if (issue.id && issue.code === 'constraint-failed') {
    const [pack, local] = split(issue.id);
    const own = message(pack, `constraints.${local}`);
    if (own) return format(own, issue.data ?? {}); // at most 3 magic items (currently 4)
  }
  return format(specText[`issues.${issue.code}`], issue.data ?? {});
}
```

The spec only ships English for its codes for now. Translate the `errors.*` and `issues.*` keys
into your app's other languages yourself.

## Credit lines

A pack's credit line (`ruleset.packs[].credit`) and its notices (`ruleset.packs[].notices`) are
legal text, not translation keys. Show them as written ([Packs and rulesets](packs-and-rulesets.md#licenses-and-credit-lines)).

## Next

- [Showing text](showing-text.md): a helper that builds these keys and formats them for you.
- [Changing characters](changing-characters.md).
