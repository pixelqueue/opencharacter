import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SPEC_VERSION } from '../../packages/spec/src/index.ts';
import { pinFiles } from './index.ts';

// Catches a spec version that `pnpm version-packages` (syncSpecVersion) would have moved.
describe('the repo states one spec version', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const [major, minor] = SPEC_VERSION.split('.');

  it(`links every schema under schemas/${major}.${minor}/`, () => {
    const stale: string[] = [];
    for (const file of pinFiles(root)) {
      const text = readFileSync(join(root, file), 'utf8');
      for (const m of text.matchAll(/(?<![\w.-])schemas\/(\d+\.\d+)\//g)) {
        if (m[1] !== `${major}.${minor}`) stale.push(`${file}: ${m[0]}`);
      }
    }
    expect(stale).toEqual([]);
  });

  it(`names ${SPEC_VERSION} wherever it states the current version`, () => {
    const stale: string[] = [];
    for (const file of pinFiles(root)) {
      const text = readFileSync(join(root, file), 'utf8');
      for (const m of text.matchAll(
        /(?:Spec version \**|current version is \**)(\d+\.\d+\.\d+)/g,
      )) {
        if (m[1] !== SPEC_VERSION) stale.push(`${file}: ${m[0]}`);
      }
    }
    expect(stale).toEqual([]);
  });
});
