import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEMA_BASE, SPEC_VERSION } from '../src/index.ts';

// `pnpm version-packages` keeps these in step (scripts/release, syncSpecVersion).
describe('spec version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };

  it('is the @opencharacter/spec package version', () => {
    expect(SPEC_VERSION).toBe(pkg.version);
  });

  it("puts the schema IDs under the version's major.minor", () => {
    const [major, minor] = pkg.version.split('.');
    expect(SCHEMA_BASE).toBe(`https://opencharacterformat.org/schemas/${major}.${minor}/`);
  });
});
