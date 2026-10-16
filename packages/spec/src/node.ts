import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export { SCHEMA_BASE, SPEC_VERSION } from './index.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Absolute paths of the spec package's folders. */
export const paths = {
  root,
  schemas: join(root, 'schemas'),
  data: join(root, 'data'),
  i18n: join(root, 'i18n'),
  tests: join(root, 'tests'),
} as const;

export interface JsonSchema {
  $id: string;
  [key: string]: unknown;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Every JSON Schema in the spec, keyed by path relative to `schemas/` (`engine/error.schema.json`). */
export function loadSchemas(): Map<string, JsonSchema> {
  const schemas = new Map<string, JsonSchema>();
  for (const file of walk(paths.schemas)
    .filter((f) => f.endsWith('.schema.json'))
    .toSorted()) {
    schemas.set(
      relative(paths.schemas, file),
      JSON.parse(readFileSync(file, 'utf8')) as JsonSchema,
    );
  }
  return schemas;
}

export interface FixedSetItem {
  id: string;
  description?: string;
  [key: string]: unknown;
}

export interface FixedSet {
  set: string;
  specVersion: string;
  description: string;
  items: FixedSetItem[];
}

/** A fixed set from `data/` by name, e.g. `effect-operations`. */
export function loadFixedSet(name: string): FixedSet {
  return JSON.parse(readFileSync(join(paths.data, `${name}.json`), 'utf8')) as FixedSet;
}

/** The ids of a fixed set, in order. */
export function fixedSetIds(name: string): string[] {
  return loadFixedSet(name).items.map((item) => item.id);
}
