import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { buildRelease } from '../../packages/engine/src/index.ts';
import type { BuiltPack } from '../build/index.ts';
import { loadPack, SchemaValidator } from '../validate/load.ts';
import { Reporter } from '../validate/report.ts';
import { publishedFromGit, releaseCheck, syncPackVersions } from './index.ts';

const fixture = fileURLToPath(new URL('./fixtures', import.meta.url));
const repo = mkdtempSync(join(tmpdir(), 'ocf-release-test-'));
afterAll(() => rmSync(repo, { recursive: true, force: true }));
const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd: repo,
    encoding: 'utf8',
  });

// A repo with the demo pack, released (tagged) at 0.1.0.
cpSync(fixture, join(repo, 'packs'), { recursive: true });
git('init', '-q');
git('add', '-A');
git('commit', '-qm', 'release 0.1.0');
git('tag', '@opencharacter/test-demo@0.1.0');

const packDir = join(repo, 'packs', 'test', 'demo');
function built(): BuiltPack {
  const pack = loadPack(packDir, repo, new SchemaValidator(), new Reporter());
  if (!pack) throw new Error('fixture did not load');
  const release = buildRelease({
    manifest: pack.manifest,
    rules: pack.rules.map((r) => r.doc),
    content: pack.content.map((c) => c.doc),
    upgrades: pack.upgrades.map((u) => u.doc),
  });
  return {
    id: 'test-demo',
    dir: packDir,
    release: { ...release, formulas: {} },
    i18n: {},
    defaultLanguage: 'en',
  };
}
const setVersion = (v: string) =>
  writeFileSync(
    join(packDir, 'pack.yaml'),
    `id: test-demo\nversion: ${v}\nspecVersion: 0.1.0\nlicense: CC0-1.0\ndefaultLanguage: en\n`,
  );

describe('release checks against git tags', () => {
  it('passes for an unchanged released version', () => {
    expect(
      releaseCheck([built()], publishedFromGit(repo)).filter((f) => f.level === 'error'),
    ).toEqual([]);
  });

  it('refuses a change that keeps a published version', () => {
    rmSync(join(packDir, 'content', 'gear', 'rope.yaml'));
    expect(releaseCheck([built()], publishedFromGit(repo)).map((f) => f.code)).toEqual([
      'published-version-changed',
    ]);
  });

  it('runs checkRelease against the latest lower release', () => {
    setVersion('0.1.1'); // rope still removed: a shape change without a breaking bump or script
    expect(releaseCheck([built()], publishedFromGit(repo)).map((f) => f.code)).toEqual([
      'version-bump-too-small',
      'missing-upgrade-script',
    ]);
  });

  it('accepts a breaking (minor, before 1.0.0) bump with a covering upgrade script', () => {
    setVersion('0.2.0');
    execFileSync('mkdir', ['-p', join(packDir, 'upgrades')]);
    writeFileSync(
      join(packDir, 'upgrades', '0.1.0-to-0.2.0.yaml'),
      'pack: test-demo\nfrom: 0.1.0\nto: 0.2.0\nsteps:\n  - { op: removeContent, id: gear.rope }\n',
    );
    const findings = releaseCheck([built()], publishedFromGit(repo));
    expect(findings.map((f) => `${f.level} ${f.code}`)).toEqual(['info ok']);
  });
});

describe('interface changes', () => {
  // A second repo with the demo pack released at 0.1.0, whose rules declare tags.
  const other = mkdtempSync(join(tmpdir(), 'ocf-release-interface-'));
  afterAll(() => rmSync(other, { recursive: true, force: true }));
  const run = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: other });
  cpSync(fixture, join(other, 'packs'), { recursive: true });
  const dir = join(other, 'packs', 'test', 'demo');
  const rules = (tags: string) =>
    writeFileSync(
      join(dir, 'rules', 'core.yaml'),
      `tags: [${tags}]\nfields:\n  stats.might: { type: integer, input: true, default: 1, min: 0, max: 10 }\ncontentTypes:\n  gear: { carried: true }\n`,
    );
  rules('sturdy, fragile');
  run('init', '-q');
  run('add', '-A');
  run('commit', '-qm', 'release 0.1.0');
  run('tag', '@opencharacter/test-demo@0.1.0');
  const version = (v: string) =>
    writeFileSync(
      join(dir, 'pack.yaml'),
      `id: test-demo\nversion: ${v}\nspecVersion: 0.1.0\nlicense: CC0-1.0\ndefaultLanguage: en\n`,
    );
  const builtHere = (): BuiltPack => {
    const pack = loadPack(dir, other, new SchemaValidator(), new Reporter());
    if (!pack) throw new Error('fixture did not load');
    const release = buildRelease({
      manifest: pack.manifest,
      rules: pack.rules.map((r) => r.doc),
      content: pack.content.map((c) => c.doc),
      upgrades: pack.upgrades.map((u) => u.doc),
    });
    return {
      id: 'test-demo',
      dir,
      release: { ...release, formulas: {} },
      i18n: {},
      defaultLanguage: 'en',
    };
  };

  it('a removed tag needs a breaking bump', () => {
    rules('sturdy');
    version('0.1.1');
    expect(releaseCheck([builtHere()], publishedFromGit(other)).map((f) => f.code)).toEqual([
      'version-bump-too-small',
    ]);
  });

  it('but no upgrade script', () => {
    version('0.2.0');
    const findings = releaseCheck([builtHere()], publishedFromGit(other));
    expect(findings.map((f) => `${f.level} ${f.code}`)).toEqual(['info ok']);
  });
});

describe('items that became standard', () => {
  // A third repo with the demo pack released at 0.1.0; 0.2.0 makes its gear standard.
  const third = mkdtempSync(join(tmpdir(), 'ocf-release-standard-'));
  afterAll(() => rmSync(third, { recursive: true, force: true }));
  const run = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: third });
  cpSync(fixture, join(third, 'packs'), { recursive: true });
  run('init', '-q');
  run('add', '-A');
  run('commit', '-qm', 'release 0.1.0');
  run('tag', '@opencharacter/test-demo@0.1.0');
  const dir = join(third, 'packs', 'test', 'demo');
  writeFileSync(
    join(dir, 'pack.yaml'),
    'id: test-demo\nversion: 0.2.0\nspecVersion: 0.1.0\nlicense: CC0-1.0\ndefaultLanguage: en\n',
  );
  writeFileSync(
    join(dir, 'rules', 'core.yaml'),
    'fields:\n  stats.might: { type: integer, input: true, default: 1, min: 0, max: 10 }\ncontentTypes:\n  gear: { carried: true }\nstandardCopies:\n  - { type: gear }\n',
  );
  execFileSync('mkdir', ['-p', join(dir, 'upgrades')]);
  const script = (steps: string) =>
    writeFileSync(
      join(dir, 'upgrades', '0.1.0-to-0.2.0.yaml'),
      `pack: test-demo\nfrom: 0.1.0\nto: 0.2.0\nsteps:\n${steps}`,
    );
  const builtHere = (): BuiltPack => {
    const pack = loadPack(dir, third, new SchemaValidator(), new Reporter());
    if (!pack) throw new Error('fixture did not load');
    const release = buildRelease({
      manifest: pack.manifest,
      rules: pack.rules.map((r) => r.doc),
      content: pack.content.map((c) => c.doc),
      upgrades: pack.upgrades.map((u) => u.doc),
    });
    return {
      id: 'test-demo',
      dir,
      release: { ...release, formulas: {} },
      i18n: {},
      defaultLanguage: 'en',
    };
  };

  it('need adoptStandard', () => {
    script('  - { op: requireChoice, choice: nothing }\n');
    expect(releaseCheck([builtHere()], publishedFromGit(third)).map((f) => f.code)).toEqual([
      'upgrade-script-incomplete',
    ]);
  });

  it('pass with it', () => {
    script('  - { op: adoptStandard, item: gear.rope }\n');
    const findings = releaseCheck([builtHere()], publishedFromGit(third));
    expect(findings.map((f) => `${f.level} ${f.code}`)).toEqual(['info ok']);
  });
});

describe('syncPackVersions', () => {
  it('copies package.json versions into pack.yaml', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ocf-sync-'));
    cpSync(fixture, dir, { recursive: true });
    writeFileSync(
      join(dir, 'test', 'demo', 'package.json'),
      JSON.stringify({ name: '@opencharacter/test-demo', version: '0.2.0' }),
    );
    expect(syncPackVersions(dir)).toEqual(['test/demo → 0.2.0']);
    expect(syncPackVersions(dir)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});
