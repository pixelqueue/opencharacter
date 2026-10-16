# Open Character Format: specification

**Spec version 0.1.0.** The shapes are in place and were checked against three hand-modeled games. The formula language and engine behavior (the core calls, actions and upgrades) are specified, and the shared test suite covers every call. Parts that are not final are marked **PROVISIONAL** or **PLACEHOLDER**.

OCF is an open format for tabletop RPG character data. The spec covers three layers:

1. **Rules:** the fields, formulas and derived values of a game ([rules-and-fields.md](rules-and-fields.md)).
2. **Content:** game-defined content types and items, such as weapons, spells and playbooks ([content.md](content.md)).
3. **Characters:** a character's saved state in one standard file ([characters.md](characters.md)).

It also defines the reference engine's interface, so every implementation exposes the same calls ([engine-interface.md](engine-interface.md)).

Core principle: **the engine knows the rules; the app owns the experience.** The engine says which fields change, what needs rolling, which options exist and which one the rules recommend. The app decides how dice are rolled, how time passes, whether choices are made automatically, and how everything looks.

## Document map

| Document                                   | Covers                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [packs.md](packs.md)                       | Pack layout, manifest, IDs, dependencies, overrides, licensing metadata                                                       |
| [rules-and-fields.md](rules-and-fields.md) | Fields, settings (rounding, stacking, competing), constraints, result bands, situational choices, link slots, creation starts |
| [content.md](content.md)                   | Content types, items, per-copy state, templates, `extends`, queries, grants, prerequisites, choices                           |
| [effects.md](effects.md)                   | Effect targets, operations and their order, competition, stacking, rounding, loops                                            |
| [formulas.md](formulas.md)                 | The formula language: grammar, tree, types, functions, dice, errors                                                           |
| [dice-and-actions.md](dice-and-actions.md) | Dice notation and modifiers, roll items, actions, checkpoints, logs, safety limits                                            |
| [characters.md](characters.md)             | The character file, a character's own homebrew, and creating a character                                                      |
| [engine-interface.md](engine-interface.md) | The calls, errors, rules issues, strict mode                                                                                  |
| [engine-core.md](engine-core.md)           | How loadRuleset, computeSheet, listOptions and applyChanges behave: activation, field computation, stacking, issues, routing  |
| [engine-actions.md](engine-actions.md)     | How startAction and continueAction run actions: building and rolling rolls, checkpoints, the log and replay                   |
| [display-hints.md](display-hints.md)       | Groups, priorities, formats, `showWhen`                                                                                       |
| [i18n.md](i18n.md)                         | Translation files and key conventions                                                                                         |
| [upgrades.md](upgrades.md)                 | Upgrade scripts                                                                                                               |
| [versioning.md](versioning.md)             | Spec, engine and pack versions                                                                                                |

## Machine-readable parts

- [`../schemas/`](../schemas/): JSON Schema (draft 2020-12) for every file format and every engine input and output. Each schema's `$id` is under `https://opencharacterformat.org/schemas/0.1/`, where the website serves the schemas, so each ID is also the schema's URL. Schema files that disagree with this prose are a spec bug. Until it is fixed, the stricter of the two applies.
- [`../data/`](../data/): the **fixed sets** as JSON: effect operations, roll modifiers, dice modifiers, die types, change types, stacking policies, error codes, rules-issue codes, upgrade steps, value types, rounding modes, display formats, safety limits and the provisional formula context. Each schema enum must equal the matching fixed set; the spec package's tests check this.
- [`../i18n/en.yaml`](../i18n/en.yaml): standard English text for the spec's error and rules-issue codes.
- [`../src/types.ts`](../src/types.ts): TypeScript types generated from the schemas (`pnpm types`), exported by `@opencharacter/spec`. The schemas are the source; the types are a convenience and are a little looser where a schema adds requirements conditionally.
- [`../tests/`](../tests/): the shared test suite: plain-data cases for the formula language and every engine call.

## Conformance

- A **pack** conforms if every file validates against its schema and every reference resolves (see [packs.md](packs.md)).
- A **character file** conforms if it validates against [`character.schema.json`](../schemas/character.schema.json) and every reference resolves in the pinned pack versions.
- An **engine** conforms to a spec version if it implements the calls in [engine-interface.md](engine-interface.md) and passes that version's test suite. Ports in other languages prove conformance the same way; there is no other certification.
- When the reference engine and the spec disagree, **the spec wins**.

## Conventions

- "MUST", "MUST NOT", "SHOULD" and "MAY" are used as in RFC 2119, and only where they matter.
- Authors write YAML, one file per item. Releases are JSON. The two are equivalent; the schemas describe the data, not the syntax.
- Identifiers and enum values are camelCase (`atLeast`, `keepHighest`). Error and issue codes are kebab-case (`unknown-id`).
