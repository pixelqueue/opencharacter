import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const SOURCE = '@opencharacter/source';

interface Pkg {
  name: string;
  private?: boolean;
  files?: string[];
  exports?: Record<string, unknown>;
  publishConfig?: { access?: string; exports?: Record<string, unknown> };
  scripts?: Record<string, string>;
  repository?: { directory?: string };
  dependencies?: Record<string, string>;
  [key: string]: unknown;
}

const dirs = [
  ...readdirSync(join(root, 'packages')).map((name) => join('packages', name)),
  ...readdirSync(join(root, 'packs'), { withFileTypes: true })
    .filter((game) => game.isDirectory())
    .flatMap((game) =>
      readdirSync(join(root, 'packs', game.name)).map((pack) => join('packs', game.name, pack)),
    ),
].filter((dir) => {
  try {
    readFileSync(join(root, dir, 'package.json'));
    return true;
  } catch {
    return false;
  }
});
const pkgs = dirs.map((dir) => ({
  dir,
  pkg: JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')) as Pkg,
}));

const withoutSource = (exports: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(exports).map(([path, target]) => [
      path,
      typeof target === 'object' && target !== null
        ? Object.fromEntries(Object.entries(target).filter(([c]) => c !== SOURCE))
        : target,
    ]),
  );

describe('published packages', () => {
  it('finds the 16 packages', () => {
    expect(pkgs.length).toBe(16);
  });

  for (const { dir, pkg } of pkgs) {
    it(`${pkg.name}: publishable`, () => {
      expect(pkg.private).toBeUndefined();
      expect(pkg.publishConfig).toMatchObject({ access: 'public' });
      expect(pkg.repository?.directory).toBe(dir);
      for (const field of ['description', 'license', 'homepage', 'bugs', 'keywords', 'engines'])
        expect(pkg[field], field).toBeDefined();
      expect(pkg.type).toBe('module');
      expect(pkg.files).toContain('dist');
      expect(pkg.files).not.toContain('src');
      expect(pkg.scripts?.prepack).toBeDefined();
      for (const range of Object.values(pkg.dependencies ?? {}))
        expect(range).not.toBe('workspace:*');
    });

    if (JSON.stringify(pkg.exports).includes(SOURCE)) {
      it(`${pkg.name}: published exports are the exports without the source condition`, () => {
        expect(pkg.publishConfig?.exports).toEqual(withoutSource(pkg.exports ?? {}));
      });
    }
  }
});
