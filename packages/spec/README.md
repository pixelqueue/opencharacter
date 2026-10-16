# @opencharacter/spec

The [Open Character Format](https://opencharacterformat.org/) (OCF) specification, as a package:
the written spec, JSON Schemas, fixed sets, standard text and the shared conformance test suite.
It is for anyone implementing OCF: engine ports in other languages, validators, and apps that
check pack or character files. It is language-neutral; the TypeScript helpers are a convenience.

Spec version **0.1.0**.

## Install

```sh
pnpm add @opencharacter/spec
```

## Example

Validate a character file against the schema (Node.js, with [Ajv](https://ajv.js.org/)):

```ts
import { Ajv2020 } from 'ajv/dist/2020.js';
import { loadSchemas } from '@opencharacter/spec/node';

const ajv = new Ajv2020({ strict: false });
for (const schema of loadSchemas().values()) ajv.addSchema(schema);
const validate = ajv.getSchema('https://opencharacterformat.org/schemas/0.1/character.schema.json');
const character = {
  specVersion: '0.1.0',
  id: 'x',
  packs: [{ id: '5e-srd-5.1', version: '0.1.0' }],
};
console.log(validate?.(character), validate?.errors); // true null
```

## What's in it

| Path or export                               | What                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`docs/`](docs/README.md)                    | The written spec, for implementers; also at [opencharacterformat.org/spec](https://opencharacterformat.org/spec/).                                     |
| `schemas/` (`@opencharacter/spec/schemas/*`) | JSON Schemas (draft 2020-12) for packs, rules, content, characters, changes, roll items and the engine calls' inputs and outputs (`schemas/engine/`).  |
| `data/` (`@opencharacter/spec/data/*`)       | The fixed sets as JSON: effect operations, dice modifiers, change types, stacking policies, error codes, formula context, …                            |
| `i18n/` (`@opencharacter/spec/i18n/en`)      | Standard English text for the spec's error and rules-issue codes, as JavaScript and JSON (built by `pnpm build`); the YAML source as `…/i18n/en.yaml`. |
| [`tests/`](tests/README.md)                  | The shared conformance test suite: cases with packs, characters and expected output.                                                                   |
| `@opencharacter/spec`                        | `SPEC_VERSION`, `SCHEMA_BASE` and the TypeScript types generated from the schemas (`CharacterFile`, …).                                                |
| `@opencharacter/spec/node`                   | Node.js helpers: `loadSchemas`, `loadFixedSet`, `fixedSetIds` and the package's `paths`.                                                               |

The schemas' `$id`s are under `https://opencharacterformat.org/schemas/0.1/`, where the website
serves them too. The [guides](https://opencharacterformat.org/guides/) show how an app uses OCF;
[`@opencharacter/engine`](https://www.npmjs.com/package/@opencharacter/engine) is the reference
engine.

## License

[Apache 2.0](LICENSE).
