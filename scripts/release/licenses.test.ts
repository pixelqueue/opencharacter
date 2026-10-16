import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

// Every published package carries a LICENSE file. A pack's LICENSE
// and the bundle's carry the pack's credit and every notice verbatim, so they can't drift from
// pack.yaml.

const root = fileURLToPath(new URL('../..', import.meta.url));
const flat = (text: string) => text.replace(/\s+/g, ' ').trim();
const read = (...path: string[]) => readFileSync(join(root, ...path), 'utf8');

interface Manifest {
  id: string;
  license: string;
  credit?: string;
  notices?: Record<string, string>;
}

const packs = readdirSync(join(root, 'packs'), { withFileTypes: true })
  .filter((game) => game.isDirectory())
  .flatMap((game) =>
    readdirSync(join(root, 'packs', game.name)).map((pack) => join('packs', game.name, pack)),
  )
  .filter((dir) => existsSync(join(root, dir, 'pack.yaml')))
  .map((dir) => ({ dir, manifest: parseYaml(read(dir, 'pack.yaml')) as Manifest }));

const legalText = (m: Manifest) => [m.credit, ...Object.values(m.notices ?? {})].filter(Boolean);

describe('licenses', () => {
  it('finds the packs', () => {
    expect(packs.length).toBeGreaterThan(0);
  });

  for (const { dir, manifest } of packs) {
    it(`${manifest.id}: LICENSE carries the credit and notices; package.json names it`, () => {
      const license = flat(read(dir, 'LICENSE'));
      for (const text of legalText(manifest)) expect(license).toContain(flat(text as string));
      const pkg = JSON.parse(read(dir, 'package.json')) as { license: string; files: string[] };
      const spdx = manifest.license.startsWith('CC') ? manifest.license : 'SEE LICENSE IN LICENSE';
      expect(pkg.license).toBe(spdx);
      expect(pkg.files).toContain('LICENSE');
    });
  }

  it("the bundle's LICENSE carries every pack's credit and notices", () => {
    const license = flat(read('packages', 'packs', 'LICENSE'));
    for (const { manifest } of packs) {
      expect(license).toContain(`(${manifest.id})`);
      for (const text of legalText(manifest)) expect(license).toContain(flat(text as string));
    }
  });

  it('the engine, spec and text packages carry the Apache 2.0 LICENSE', () => {
    for (const name of ['engine', 'spec', 'text']) {
      expect(read('packages', name, 'LICENSE')).toBe(read('LICENSE'));
      expect(
        (JSON.parse(read('packages', name, 'package.json')) as { license: string }).license,
      ).toBe('Apache-2.0');
    }
  });
});
