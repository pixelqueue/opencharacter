// @opencharacter/spec, pure entry: constants only, safe in any JavaScript runtime. File-system
// helpers (schemas, fixed sets, paths) are in `@opencharacter/spec/node`.

/** The OCF spec version these schemas and data describe. */
export const SPEC_VERSION = '0.1.0';

/** Base URI of every schema `$id` in this spec version. */
export const SCHEMA_BASE = 'https://opencharacterformat.org/schemas/0.1/';

/** Types generated from the JSON Schemas (`pnpm types`). */
export type * from './types.ts';
