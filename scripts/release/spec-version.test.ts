import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SPEC_VERSION } from '../../packages/spec/src/index.ts';
import { pinFiles } from './index.ts';

// Catches a spec version that `pnpm version-packages` (syncSpecVersion) would have moved.
describe('the repo states one spec version', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const [major, minor] = SPEC_VERSION.split('.');
  const texts = pinFiles(root)
    .filter((file) => existsSync(join(root, file)))
    .map((file) => ({ file, text: readFileSync(join(root, file), 'utf8') }));

  function stale(re: RegExp, expected: string) {
    return texts.flatMap(({ file, text }) =>
      [...text.matchAll(re)].filter((m) => m[1] !== expected).map((m) => `${file}: ${m[0]}`),
    );
  }

  it(`links every schema under schemas/${major}.${minor}/`, () => {
    expect(stale(/(?<![\w.-])schemas\/(\d+\.\d+)\//g, `${major}.${minor}`)).toEqual([]);
  });

  it(`names ${SPEC_VERSION} wherever it states the current version`, () => {
    expect(
      stale(/(?:Spec version \**|current version is \**)(\d+\.\d+\.\d+)/g, SPEC_VERSION),
    ).toEqual([]);
  });
});
