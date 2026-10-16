# web-editor

A local editor for the packs in this repo, for pack authors working in a checkout of the Open
Character Format repository. It is private (`@opencharacter/web-editor`, `private: true`): never
published to npm and never hosted.

Run it from the repo root after `pnpm install`: `pnpm editor` starts it at http://127.0.0.1:5173.

- **Pack tree:** every game, pack, rules file, content item and translation file under `packs/`.
- **Item form:** generated from the item's content type. It has typed controls for each declared
  field, live formula checking with the reference parser (and the canonical form), tags, and the
  item's name and description in the pack's default language. A YAML tab is always there too.
- **Schema forms:** rules files, `pack.yaml`, upgrade scripts, and everything on an item beyond
  its fields (effects, actions, choices, grants, …) are edited with forms generated from the
  spec's JSON Schemas (`packages/spec/schemas/`).
  - The forms follow `$ref`s, unions and `if`/`then` (an effect's value changes shape with its
    `op`), and check formula fields live.
  - Saving sends only what changed, so comments elsewhere survive.
- **Translations:** a table per pack, with a row per key and a column per language.
  - Missing keys are highlighted, including keys the validator requires but nobody has written
    yet.
  - Add a language column to start a translation.
- **Validation:** `pnpm validate` runs after every save; findings for the open file come first.
- **Preview:** computes an example character with the current packs, using the engine.
- **Changes:** git status and diff for `packs/`.
  - Git is the database: review the diff and commit yourself (`git commit -s`).
  - The editor never commits, pushes or publishes.

Edits keep comments and layout, and files are formatted with the repo's formatter (oxfmt), so
saving changes only what you changed and the result passes `pnpm lint`. The server listens on
localhost only, and reads and writes only `.yaml` files under `packs/`.

## License

[Apache 2.0](../../LICENSE), like the rest of the project's code.
