import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { buildRelease } from '../../packages/engine/src/index.ts';
import type { BuiltPack } from '../build/index.ts';
import { loadPack, SchemaValidator } from '../validate/load.ts';
import { Reporter } from '../validate/report.ts';
import {
  publishedFromGit,
  releaseCheck,
  syncPackVersions,
  syncPinnedVersions,
  syncSpecVersion,
} from './index.ts';
import { pendingVersions } from './pending.ts';

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

describe('pending changesets', () => {
  // A workspace with the demo pack released at 0.1.0, as Changesets reads it.
  const ws = mkdtempSync(join(tmpdir(), 'ocf-release-pending-'));
  afterAll(() => rmSync(ws, { recursive: true, force: true }));
  const run = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: ws });
  cpSync(fixture, join(ws, 'packs'), { recursive: true });
  const dir = join(ws, 'packs', 'test', 'demo');
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'root', private: true }));
  writeFileSync(join(ws, 'pnpm-workspace.yaml'), "packages:\n  - 'packs/*/*'\n");
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: '@opencharacter/test-demo', version: '0.1.0' }),
  );
  mkdirSync(join(ws, '.changeset'));
  writeFileSync(
    join(ws, '.changeset', 'config.json'),
    JSON.stringify({ changelog: false, baseBranch: 'main', access: 'public' }),
  );
  writeFileSync(join(ws, '.changeset', 'README.md'), '# Changesets\n');
  run('init', '-q');
  run('add', '-A');
  run('commit', '-qm', 'release 0.1.0');
  run('tag', '@opencharacter/test-demo@0.1.0');

  const changeset = (bump?: 'patch' | 'minor') => {
    const file = join(ws, '.changeset', 'demo-change.md');
    if (bump) writeFileSync(file, `---\n'@opencharacter/test-demo': ${bump}\n---\n\nA change.\n`);
    else rmSync(file, { force: true });
  };
  const upgrade = (to?: string) => {
    rmSync(join(dir, 'upgrades'), { recursive: true, force: true });
    if (!to) return;
    mkdirSync(join(dir, 'upgrades'));
    writeFileSync(
      join(dir, 'upgrades', `0.1.0-to-${to}.yaml`),
      `pack: test-demo\nfrom: 0.1.0\nto: ${to}\nsteps:\n  - { op: removeContent, id: gear.rope }\n`,
    );
  };
  const builtHere = (): BuiltPack => {
    const pack = loadPack(dir, ws, new SchemaValidator(), new Reporter());
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
  const findings = () =>
    releaseCheck([builtHere()], publishedFromGit(ws), undefined, pendingVersions(ws));
  const check = () => findings().map((f) => `${f.level} ${f.code}`);

  it('reads the release plan', () => {
    expect(pendingVersions(ws)).toEqual(new Map());
    changeset('patch');
    expect(pendingVersions(ws)).toEqual(new Map([['test-demo', '0.1.1']]));
    changeset('minor');
    expect(pendingVersions(ws)).toEqual(new Map([['test-demo', '0.2.0']]));
  });

  it('lets a published version change with a changeset', () => {
    writeFileSync(join(dir, 'content', 'gear', 'lamp.yaml'), 'id: gear.lamp\ntype: gear\n');
    changeset();
    expect(check()).toEqual(['error published-version-changed']);
    changeset('patch');
    expect(check()).toEqual(['info pending-bump', 'info ok']);
    expect(findings()[0]?.message).toBe('test-demo 0.1.0 → 0.1.1 (pending changeset)');
    rmSync(join(dir, 'content', 'gear', 'lamp.yaml'));
  });

  it('needs a breaking changeset and an upgrade to its version for a shape change', () => {
    rmSync(join(dir, 'content', 'gear', 'rope.yaml'));
    changeset();
    expect(check()).toEqual(['error published-version-changed']);
    changeset('patch');
    upgrade('0.1.1');
    expect(check()).toEqual(['info pending-bump', 'error version-bump-too-small']);
    changeset('minor');
    expect(check()).toEqual(['info pending-bump', 'error missing-upgrade-script']);
    upgrade('0.2.0');
    expect(check()).toEqual(['info pending-bump', 'info ok']);
  });

  it('checks as before once the version is bumped', () => {
    changeset();
    writeFileSync(
      join(dir, 'pack.yaml'),
      'id: test-demo\nversion: 0.2.0\nspecVersion: 0.1.0\nlicense: CC0-1.0\ndefaultLanguage: en\n',
    );
    expect(check()).toEqual(['info ok']);
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
    expect(syncPackVersions(dir)).toEqual([{ id: 'test-demo', from: '0.1.0', to: '0.2.0' }]);
    expect(syncPackVersions(dir)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('syncPinnedVersions', () => {
  const bumps = [{ id: 'test-demo', from: '0.1.0', to: '0.1.1' }];
  const files: Record<string, [string, string]> = {
    'flow.yaml': [
      'packs:\n  - { id: test-demo, version: 0.1.0 }\n  - { id: other, version: 0.1.0 }\n',
      'packs:\n  - { id: test-demo, version: 0.1.1 }\n  - { id: other, version: 0.1.0 }\n',
    ],
    'block.yaml': [
      'packs:\n  - id: test-demo\n    version: 0.1.0\n',
      'packs:\n  - id: test-demo\n    version: 0.1.1\n',
    ],
    'sample.ts': [
      "packs: [{ id: 'test-demo', version: '0.1.0' }],\n",
      "packs: [{ id: 'test-demo', version: '0.1.1' }],\n",
    ],
    'data.json': [
      '{ "id": "test-demo", "version": "0.1.0" }\n',
      '{ "id": "test-demo", "version": "0.1.1" }\n',
    ],
    'upgrade.yaml': [
      '- { id: test-demo, version: 0.0.9 }\n- { id: test-demo, version: 0.1.0-beta }\n',
      '- { id: test-demo, version: 0.0.9 }\n- { id: test-demo, version: 0.1.0-beta }\n',
    ],
  };

  it('moves pins of the old version only, in every form', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ocf-pins-'));
    for (const [name, [before]] of Object.entries(files)) writeFileSync(join(dir, name), before);
    expect(syncPinnedVersions(dir, Object.keys(files), bumps).toSorted()).toEqual([
      'block.yaml',
      'data.json',
      'flow.yaml',
      'sample.ts',
    ]);
    for (const [name, [, after]] of Object.entries(files)) {
      expect(readFileSync(join(dir, name), 'utf8')).toBe(after);
    }
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('syncSpecVersion', () => {
  // Built from parts, so the real sync and the repo's spec-version test skip this file.
  const [constant, schemas, spec, current] = [
    'SPEC_VERSION',
    'schemas',
    'Spec version',
    'current version is',
  ];
  const files: Record<string, [string, string]> = {
    'packages/spec/src/index.ts': [
      `export const ${constant} = '0.1.0';\n`,
      `export const ${constant} = '0.2.0';\n`,
    ],
    'packages/spec/schemas/pack.schema.json': [
      `{ "$id": "https://opencharacterformat.org/${schemas}/0.1/pack.schema.json" }\n`,
      `{ "$id": "https://opencharacterformat.org/${schemas}/0.2/pack.schema.json" }\n`,
    ],
    'docs/versioning.md': [
      `The ${current} **0.1.0**, which is pre-1.0. IDs are under \`/${schemas}/0.1/\`.\n`,
      `The ${current} **0.2.0**, which is pre-1.0. IDs are under \`/${schemas}/0.2/\`.\n`,
    ],
    'docs/README.md': [
      `**${spec} 0.1.0.** ${spec} **0.1.0**. ${spec} 0.1.0.1.\n`,
      `**${spec} 0.2.0.** ${spec} **0.2.0**. ${spec} 0.1.0.1.\n`,
    ],
    'examples/characters/sample.yaml': [
      'specVersion: 0.1.0\npacks:\n  - { id: demo, version: 0.1.0 }\n',
      'specVersion: 0.2.0\npacks:\n  - { id: demo, version: 0.1.0 }\n',
    ],
    'character.yaml': [
      'specVersion: 0.1.0\npacks:\n  - { id: demo, version: 0.1.0 }\n',
      'specVersion: 0.1.0\npacks:\n  - { id: demo, version: 0.1.0 }\n',
    ],
    'other.md': [
      `see my${schemas}/0.1/ and ${schemas}/0.10/\n`,
      `see my${schemas}/0.1/ and ${schemas}/0.10/\n`,
    ],
  };

  function setup(version: string) {
    const dir = mkdtempSync(join(tmpdir(), 'ocf-spec-'));
    for (const [name, [before]] of Object.entries(files)) {
      mkdirSync(join(dir, name, '..'), { recursive: true });
      writeFileSync(join(dir, name), before);
    }
    writeFileSync(
      join(dir, 'packages', 'spec', 'package.json'),
      JSON.stringify({ name: '@opencharacter/spec', version }),
    );
    return dir;
  }

  it('moves SPEC_VERSION, schema paths, the stated version and example characters, not other minimums', () => {
    const dir = setup('0.2.0');
    const result = syncSpecVersion(dir, Object.keys(files));
    expect(result?.bump).toEqual({ from: '0.1.0', to: '0.2.0' });
    expect(result?.files.toSorted()).toEqual([
      'docs/README.md',
      'docs/versioning.md',
      'examples/characters/sample.yaml',
      'packages/spec/schemas/pack.schema.json',
      'packages/spec/src/index.ts',
    ]);
    for (const [name, [, after]] of Object.entries(files)) {
      expect(readFileSync(join(dir, name), 'utf8')).toBe(after);
    }
    expect(syncSpecVersion(dir, Object.keys(files))).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });

  it('leaves schema paths alone on a patch bump', () => {
    const dir = setup('0.1.1');
    expect(syncSpecVersion(dir, Object.keys(files))?.files.toSorted()).toEqual([
      'docs/README.md',
      'docs/versioning.md',
      'examples/characters/sample.yaml',
      'packages/spec/src/index.ts',
    ]);
    const schema = 'packages/spec/schemas/pack.schema.json';
    expect(readFileSync(join(dir, schema), 'utf8')).toBe(files[schema]?.[0]);
    rmSync(dir, { recursive: true, force: true });
  });
});
