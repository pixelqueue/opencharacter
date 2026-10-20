import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { computeSheet, loadRuleset, type Ruleset } from '../../packages/engine/src/index.ts';
import { parse } from '../../packages/engine/src/formula/index.ts';
import { loadSchemas, SCHEMA_BASE } from '../../packages/spec/src/node.ts';
import { readPack } from '../../packages/engine/test/packs.ts';
import { buildPacks, specText, writePacksBundle, writePack, writeSpecText } from './index.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { reporter, built } = buildPacks(root);

describe('pnpm build:packs on the repository packs', () => {
  it('builds every pack without errors', () => {
    expect(reporter.errors).toEqual([]);
    expect(built.map((b) => b.id)).toEqual([
      '5e-srd-5.1',
      'divine-heroes-core',
      'fate-core',
      'fitd-crew',
      'fitd-scoundrel',
      'mork-borg-core',
      'mothership-1e',
      'orc-2e',
    ]);
  });

  it("writes the bundle with each pack's English text by pack ID", () => {
    const repo = mkdtempSync(join(tmpdir(), 'ocf-bundle-'));
    writePacksBundle(repo, built);
    const dir = join(repo, 'packages', 'packs', 'dist', 'i18n');
    const en = JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8')) as Record<
      string,
      Record<string, string>
    >;
    expect(Object.keys(en)).toEqual(built.map((b) => b.id));
    for (const b of built) expect(en[b.id]).toEqual(b.i18n.en);
    const js = readFileSync(join(dir, 'en.js'), 'utf8');
    expect(js).toContain("from '@opencharacter/5e-srd-5.1/i18n/en'");
    expect(existsSync(join(dir, 'en.d.ts'))).toBe(true);
    rmSync(repo, { recursive: true, force: true });
  });

  it('produces releases that are valid pack releases', () => {
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
    addFormats.default(ajv);
    for (const schema of loadSchemas().values()) ajv.addSchema(schema);
    const validate = ajv.getSchema(`${SCHEMA_BASE}pack-release.schema.json`);
    for (const pack of built)
      expect(validate?.(pack.release), `${pack.id}: ${JSON.stringify(validate?.errors)}`).toBe(
        true,
      );
  });

  it('compiles every formula: the tree parses from the canonical text', () => {
    for (const pack of built) {
      expect(Object.keys(pack.release.formulas).length).toBeGreaterThan(2);
      for (const [source, compiled] of Object.entries(pack.release.formulas)) {
        const fromSource = parse(source);
        const fromCanonical = parse(compiled.text);
        expect(fromSource.ok && fromSource.value).toEqual(compiled.tree);
        expect(fromCanonical.ok && fromCanonical.value).toEqual(compiled.tree);
      }
    }
  });

  it('computes the example characters the same from releases as from sources', () => {
    const fromReleases = loadRuleset(built.map((b) => b.release));
    const fromSources = loadRuleset(built.map((b) => readPack(b.dir)));
    if (!fromReleases.ok || !fromSources.ok) throw new Error('loadRuleset failed');
    for (const file of [
      '5e-tamsin.yaml',
      '5e-goblin.yaml',
      'mothership-okafor.yaml',
      'divine-heroes-tavian.yaml',
      'divine-heroes-ysolde.yaml',
      'fitd-vex.yaml',
      'fitd-crew-ravens.yaml',
      'fate-mara.yaml',
      'orc-valeria.yaml',
      'orc-ren.yaml',
      'orc-ines.yaml',
      'orc-edda.yaml',
      'orc-tessaly.yaml',
      'orc-oriel.yaml',
      'orc-sela.yaml',
      'orc-bramble.yaml',
      'orc-lyra.yaml',
      'orc-morwen.yaml',
      'orc-cassia.yaml',
      'orc-aldric.yaml',
      'orc-fenn.yaml',
    ]) {
      const character = parseYaml(readFileSync(join(root, 'examples', 'characters', file), 'utf8'));
      const sheet = (r: Ruleset) => computeSheet(r, character).values;
      expect(sheet(fromReleases.ruleset), file).toEqual(sheet(fromSources.ruleset));
    }
  }, 30_000); // loads every pack twice and computes each example character twice
});

describe('translation packaging', () => {
  it('requires an -i18n package for languages other than the default', () => {
    const repo = mkdtempSync(join(tmpdir(), 'ocf-build-'));
    cpSync(fileURLToPath(new URL('./fixtures', import.meta.url)), repo, { recursive: true });
    const result = buildPacks(repo);
    expect(result.reporter.errors).toEqual([]);
    const pack = result.built[0];
    if (!pack) throw new Error('no pack built');
    expect(writePack(pack)[0]).toMatch(/has translations \(de\) but no -i18n package/);
    expect(existsSync(join(pack.dir, 'dist'))).toBe(false);

    mkdirSync(join(pack.dir, 'i18n-package'));
    writeFileSync(join(pack.dir, 'i18n-package', 'package.json'), '{}');
    expect(writePack(pack)).toEqual([]);
    expect(
      JSON.parse(readFileSync(join(pack.dir, 'dist', 'i18n', 'en.json'), 'utf8'))['gear.rope.name'],
    ).toBe('Rope');
    expect(
      JSON.parse(readFileSync(join(pack.dir, 'i18n-package', 'dist', 'de.json'), 'utf8'))[
        'gear.rope.name'
      ],
    ).toBe('Seil');
    expect(existsSync(join(pack.dir, 'dist', 'i18n', 'de.json'))).toBe(false);
    rmSync(repo, { recursive: true, force: true });
  });
});

describe("the spec's standard text", () => {
  const spec = join(root, 'packages', 'spec');

  it('reads every language of the spec package', () => {
    const en = parseYaml(readFileSync(join(spec, 'i18n', 'en.yaml'), 'utf8')) as Record<
      string,
      string
    >;
    expect(specText(spec)).toEqual({ en });
    expect(en['issues.too-many-copies']).toBeDefined();
  });

  it('is exported as @opencharacter/spec/i18n/<lang>, as JavaScript and JSON', () => {
    const repo = mkdtempSync(join(tmpdir(), 'ocf-spec-text-'));
    const copy = join(repo, 'node_modules', '@opencharacter', 'spec');
    mkdirSync(copy, { recursive: true });
    cpSync(join(spec, 'package.json'), join(copy, 'package.json'));
    cpSync(join(spec, 'i18n'), join(copy, 'i18n'), { recursive: true });
    expect(writeSpecText(copy)).toEqual(['en']);
    const en = specText(spec).en;
    const dist = join(copy, 'dist', 'i18n');
    expect(JSON.parse(readFileSync(join(dist, 'en.json'), 'utf8'))).toEqual(en);
    expect(readFileSync(join(dist, 'en.d.ts'), 'utf8')).toContain('Record<string, string>');
    // Node resolves the entry points through the package's exports: the module for `import`,
    // the JSON for `require`, and the YAML source as before.
    const script = [
      "import en from '@opencharacter/spec/i18n/en';",
      "import { createRequire } from 'node:module';",
      'const require = createRequire(import.meta.url);',
      "const json = require('@opencharacter/spec/i18n/en');",
      "const yaml = import.meta.resolve('@opencharacter/spec/i18n/en.yaml');",
      'console.log(JSON.stringify({ en, json, yaml }));',
    ].join('\n');
    writeFileSync(join(repo, 'check.mjs'), script);
    const out = JSON.parse(
      execFileSync(process.execPath, [join(repo, 'check.mjs')], { cwd: repo, encoding: 'utf8' }),
    ) as { en: unknown; json: unknown; yaml: string };
    expect(out.en).toEqual(en);
    expect(out.json).toEqual(en);
    expect(out.yaml.endsWith('/i18n/en.yaml')).toBe(true);
    rmSync(repo, { recursive: true, force: true });
  });
});
