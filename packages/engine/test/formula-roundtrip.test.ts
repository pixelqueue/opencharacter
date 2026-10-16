import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import * as f from '../src/formula/index.ts';

const packs = fileURLToPath(new URL('../../../packs', import.meta.url));

function yamlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'i18n' ? [] : yamlFiles(path);
    return name.endsWith('.yaml') ? [path] : [];
  });
}

function strings(data: unknown, out: string[] = []): string[] {
  if (typeof data === 'string') out.push(data);
  else if (Array.isArray(data)) for (const item of data) strings(item, out);
  else if (data && typeof data === 'object')
    for (const value of Object.values(data)) strings(value, out);
  return out;
}

describe('every formula in the packs round-trips through the printer', () => {
  const texts = [
    ...new Set(yamlFiles(packs).flatMap((file) => strings(parseYaml(readFileSync(file, 'utf8'))))),
  ];
  const trees = texts.flatMap((text) => {
    const result = f.parse(text);
    return result.ok ? [[text, result.value] as const] : [];
  });

  it('finds formulas to test', () => {
    expect(trees.length).toBeGreaterThan(100);
  });

  it.each(trees)('%s', (_, tree) => {
    const text = f.print(tree);
    const again = f.parse(text);
    expect(again.ok && again.value).toEqual(tree);
    expect(again.ok && f.print(again.value)).toBe(text);
  });
});
