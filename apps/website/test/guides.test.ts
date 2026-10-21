import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import * as engine from '../../../packages/engine/src/index.ts';
import { readPack } from '../../../packages/engine/test/packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const guides = join(root, 'apps/website/guides');
const read = (file: string) => readFileSync(file, 'utf8');

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) =>
    statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)],
  );

/** A pack's text in one language: the language's file plus every file in its folder. */
function text(dir: string, language: string): Record<string, string> {
  const files = [join(dir, `i18n/${language}.yaml`)];
  const folder = join(dir, `i18n/${language}`);
  files.push(...walk(folder).filter((f) => f.endsWith('.yaml')));
  return Object.assign({}, ...files.map((f) => parse(read(f))));
}

/** A page's main code block: the TypeScript block that loads a ruleset. */
function mainBlock(file: string): string {
  const page = read(file);
  const code = [...page.matchAll(/```ts\n([\s\S]*?)```/g)]
    .map((m) => m[1]!)
    .find((block) => block.includes('loadRuleset(['));
  if (!code) throw new Error(`${file} has no block that loads a ruleset`);
  return code;
}
const quickStart = () => mainBlock(join(guides, 'quick-start.md'));
const readme = () => mainBlock(join(root, 'README.md'));

/** The repository's TypeScript compiler, run in `dir`: its output, whether or not it fails. */
function tsc(dir: string, args: string[]): string {
  const bin = join(root, 'node_modules/typescript/bin/tsc');
  try {
    return execFileSync(process.execPath, [bin, '--pretty', 'false', ...args], {
      cwd: dir,
      encoding: 'utf8',
    });
  } catch (error) {
    return String((error as { stdout?: unknown }).stdout ?? error);
  }
}

/** Writes each code block to its own module (`export {}`), so their names don't clash. */
const writeBlocks = (dir: string, codes: string[]) =>
  codes.map((code, i) => {
    const file = `example-${i}.ts`;
    writeFileSync(join(dir, file), `${code}\nexport {};\n`);
    return file;
  });

/**
 * TypeScript's errors in each code block, its published package names pointed at the repository.
 * One program checks every block, so the engine's source is checked once.
 */
function typeErrors(codes: string[]): string[][] {
  const sources = codes.map((code) =>
    code
      // The types a built pack declares (dist/index.d.ts, dist/i18n/en.d.ts).
      .replace(
        /^import srd from .*$/m,
        "declare const srd: import('@opencharacter/engine').PackRelease;",
      )
      .replace(/^import en from .*$/m, 'declare const en: Record<string, string>;')
      .replaceAll("'@opencharacter/engine'", `'${join(root, 'packages/engine/src/index.ts')}'`),
  );
  const dir = mkdtempSync(join(tmpdir(), 'ocf-guide-'));
  try {
    const files = writeBlocks(dir, sources);
    const compilerOptions = {
      strict: true,
      noEmit: true,
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      paths: { '@opencharacter/spec': [join(root, 'packages/spec/src/index.ts')] },
    };
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions, files }));
    // One error per line, its message's further lines indented.
    const errors = tsc(dir, ['-p', '.']).split(/\n(?=\S)/);
    return files.map((file) => errors.filter((e) => e.startsWith(`${file}(`)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const once = <T>(make: () => T): (() => T) => {
  let value: { v: T } | undefined;
  return () => (value ??= { v: make() }).v;
};

/** The quick start's and the README's type errors, from one program. */
const blockErrors = once(() => {
  const [quick = [], readmeErrors = []] = typeErrors([quickStart(), readme()]);
  return { quick, readme: readmeErrors };
});

/** 5E 5.1 built from its sources, read once for the tests that run it. */
const srdDir = join(root, 'packs/5e/srd-5.1');
const srd = once(() => readPack(srdDir));

/** A code block as a function body: types removed, its imports left for the caller to supply. */
function runnable(code: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ocf-guide-'));
  try {
    const [file = ''] = writeBlocks(dir, [code]);
    tsc(dir, ['--noCheck', '--noResolve', '--target', 'ES2022', '--module', 'ESNext', file]);
    return read(join(dir, file.replace(/\.ts$/, '.js')))
      .replace(/^import [^;]*;$/gm, '')
      .replace(/^export \{\};$/m, '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The type checks build one TypeScript program over the engine's sources: seconds under load.
describe('guides', { timeout: 30_000 }, () => {
  it('type-checks the quick start against the engine', () => {
    expect(blockErrors().quick).toEqual([]);
  });

  it('type-checks the README example against the engine', () => {
    expect(blockErrors().readme).toEqual([]);
  });

  it('runs the README example as written', () => {
    const run = new Function(
      'engine',
      'srd',
      `const { computeSheet, loadRuleset, SPEC_VERSION } = engine;
      ${runnable(readme())}
      return sheet.values['5e-srd-5.1:abilities.str.mod']?.value;`,
    );
    expect(run(engine, srd())).toBe(3);
  });

  it('runs the quick start as written', () => {
    // The imports name the published packages; supply the same things from the repository.
    const body = runnable(quickStart());
    const logs: unknown[][] = [];
    const run = new Function(
      'engine',
      'srd',
      'en',
      'console',
      `
      const { applyChanges, computeSheet, loadRuleset, SPEC_VERSION, startAction } = engine;
      ${body}
    `,
    );
    run(engine, srd(), text(srdDir, 'en'), { log: (...args: unknown[]) => logs.push(args) });
    expect(logs[0]).toEqual(['Strength modifier', 3]);
  });

  it('changes only input fields', () => {
    const loaded = engine.loadRuleset([srd()]);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const fields = loaded.ruleset.fields as Record<string, { input?: boolean }>;
    const wrong: string[] = [];
    for (const name of readdirSync(guides).filter((n) => n.endsWith('.md'))) {
      const page = read(join(guides, name));
      // A `set` or `adjust` change's field, and a character file's saved values.
      const ids = [
        ...page.matchAll(/type: '(?:set|adjust)', field: '(5e-srd-5\.1:[\w.]+)'/g),
        ...page.matchAll(/^\s+'(5e-srd-5\.1:[\w.]+)': -?\d/gm),
      ].map((m) => m[1]!);
      for (const id of ids) if (!fields[id]?.input) wrong.push(`${name}: ${id}`);
    }
    expect(wrong).toEqual([]);
  });
});
