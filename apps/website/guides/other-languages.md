# Apps not written in JavaScript

The reference engine is TypeScript. If your app is in C#, Swift, Kotlin, Python, Rust, Go or
GDScript, you have three options: run the reference engine from your language, call it as a local
service, or use (or write) a port. All three give the same results, because everything crosses the
boundary as JSON.

## Everything is JSON

Every engine call's inputs and outputs are defined as JSON Schema in
[`schemas/engine/`](../../../packages/spec/schemas/engine/), published with the spec at
`schemas/0.1/` on this site. Pack releases, character files and changes are JSON too. So in any
language you can:

- generate types for the calls from the schemas (quicktype, NJsonSchema, datamodel-code-generator
  and similar tools);
- validate character files and changes with any JSON Schema (draft 2020-12) validator;
- treat rulesets and paused actions as opaque JSON you store and pass back.

The engine is also pure: no file or network access, no clock, no memory between calls. Your app
loads the packs and passes them in. That's what makes the next two options work.

## Option 1: embed the reference engine

Run the TypeScript engine, compiled to JavaScript, inside a JavaScript runtime embedded in your
app:

| Platform         | Embeddable runtime                      |
| ---------------- | --------------------------------------- |
| iOS, macOS       | JavaScriptCore (built into the OS)      |
| Android, JVM     | QuickJS or V8 bindings (J2V8, Javet)    |
| .NET, Unity      | Jint, ClearScript, or QuickJS bindings  |
| Python           | QuickJS bindings, or py_mini_racer (V8) |
| C, C++, Rust, Go | QuickJS (C), rquickjs (Rust), goja (Go) |

Bundle the engine into one JavaScript file (esbuild or similar), load it into the runtime, and
expose thin wrappers that take and return JSON strings:

```js
// bundled entry point, compiled to one file
import * as engine from '@opencharacter/engine';

globalThis.ocf = {
  loadRuleset: (packs) => JSON.stringify(engine.loadRuleset(JSON.parse(packs))),
  computeSheet: (ruleset, character) =>
    JSON.stringify(engine.computeSheet(JSON.parse(ruleset), JSON.parse(character))),
  // …the same for the other calls
};
```

Two things to plan for:

- **Keep the ruleset on the JavaScript side.** It's large, and parsing it on every call is
  wasteful. Load it once into a variable in the runtime and refer to it by handle.
- **Dice:** the dice function is a callback, not data. Either let the engine use its own random
  dice, or avoid callbacks entirely by running actions with `policy: { dice: 'pause' }` and
  answering each pause with faces rolled in your language
  ([Rolling dice](rolling-dice.md#who-rolls-the-dice)). The pause-and-continue loop is all
  JSON.

This is the quickest way to get exactly the reference engine's results. The project doesn't test
or package any particular embedding yet.

## Option 2: a local service

If your app runs on a server, run the engine as a small Node, Deno or Bun process beside it and
call it over HTTP or a pipe with the same JSON. Keep rulesets cached in that process. OCF has no
hosted service, by design; this is a process you run yourself, next to your own app.

## Option 3: a port

A port reimplements the engine in another language. **There is no certification:** a port is
conformant for a spec version when it passes that version's shared test suite. The cases are plain
YAML ([`tests/`](../../../packages/spec/tests/README.md)), so any language can run them:

| Area        | Covers                              | Cases (spec 0.1) |
| ----------- | ----------------------------------- | ---------------- |
| `formulas/` | Parsing, printing, evaluation, dice | 24 topic files   |
| `loads/`    | `loadRuleset`                       | 100              |
| `sheets/`   | `computeSheet`                      | 414              |
| `options/`  | `listOptions`                       | 30               |
| `changes/`  | `applyChanges`                      | 277              |
| `actions/`  | `startAction`, `continueAction`     | 1066             |
| `upgrades/` | `upgrade`, `checkRelease`           | 61               |

A port doesn't have to start with everything:

- **Formula parsing is optional.** Pack releases include each formula's parsed tree (the
  `formulas` table), so a port can walk trees and skip the parser.
- **A viewer needs less than a builder.** Formulas, `loadRuleset` and `computeSheet` are enough to
  show a sheet; add `applyChanges` and `listOptions` to edit, actions to roll, `upgrade` last.
  `checkRelease` is build tooling for pack authors, not something apps call.
- Claim conformance only for the parts whose cases you pass.

The spec chapters for implementers are [engine core](../../../packages/spec/docs/engine-core.md),
[actions at run time](../../../packages/spec/docs/engine-actions.md) and
[formulas](../../../packages/spec/docs/formulas.md). When the reference engine and the spec
disagree, the spec wins.

Rulesets and paused actions aren't portable between engines: their inner shape is PROVISIONAL and
engine-specific, so a port builds its own ruleset from the same pack releases. Character files,
changes and pack releases are standard, so a character moves freely between apps on different
engines.

## Not yet: WebAssembly

A single engine compiled to WebAssembly would run in most languages with identical results. It's
an open idea, not a plan.
