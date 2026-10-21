// @opencharacter/spec, pure entry: constants only, safe in any JavaScript runtime. File-system
// helpers (schemas, fixed sets, paths) are in `@opencharacter/spec/node`.

/** The OCF spec version these schemas and data describe: the `@opencharacter/spec` version. */
export const SPEC_VERSION = '0.1.0';

/** Base URI of every schema `$id` in this spec version (its major.minor). */
export const SCHEMA_BASE = `https://opencharacterformat.org/schemas/${SPEC_VERSION.split('.').slice(0, 2).join('.')}/`;

/** Types generated from the JSON Schemas (`pnpm types`). */
export type * from './types.ts';
