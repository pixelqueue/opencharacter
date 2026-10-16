import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { paths } from '@opencharacter/spec/node';

// Every error and rules-issue code the reference engine can emit is in the spec's fixed
// sets, and every code in those sets has standard English text, so no bare code reaches players.

const src = resolve(import.meta.dirname, '..', 'src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

const ids = (set: string): string[] =>
  (
    JSON.parse(readFileSync(join(paths.data, `${set}.json`), 'utf8')) as {
      items: { id: string }[];
    }
  ).items.map((x) => x.id);

describe('error and issue codes', () => {
  const errors = new Set(ids('error-codes'));
  const issues = new Set(ids('rules-issue-codes'));
  const en = parse(readFileSync(join(paths.i18n, 'en.yaml'), 'utf8')) as Record<string, string>;

  it('every code the engine emits is in a fixed set', () => {
    const emitted = new Set<string>();
    for (const file of sources(src))
      for (const m of readFileSync(file, 'utf8').matchAll(
        /(?:code: |\bfail\(|Failure\()'([a-z]+(?:-[a-z]+)*)'/g,
      ))
        emitted.add(m[1]!);
    expect(emitted.size).toBeGreaterThan(40);
    expect([...emitted].filter((c) => !errors.has(c) && !issues.has(c))).toEqual([]);
  });

  it('every code in the fixed sets has standard text, and so has a code without its own', () => {
    expect([...errors].filter((c) => typeof en[`errors.${c}`] !== 'string')).toEqual([]);
    expect([...issues].filter((c) => typeof en[`issues.${c}`] !== 'string')).toEqual([]);
    expect(en['errors.other']).toContain('{code}');
  });
});
