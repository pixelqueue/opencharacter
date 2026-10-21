import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import semver from 'semver';
import {
  buildRelease,
  checkRelease,
  type PackRelease,
  type ReleaseDependencies,
} from '../../packages/engine/src/index.ts';
import type { BuiltPack } from '../build/index.ts';
import { loadPack, SchemaValidator } from '../validate/load.ts';
import { Reporter } from '../validate/report.ts';

// Release checks: packages/spec/docs/versioning.md, "The release flow".

export interface PublishedReleases {
  /** The release published under the pack's current version, if any. */
  same?: PackRelease;
  /** The latest release published under a lower version, if any. */
  previous?: PackRelease;
}

export interface ReleaseFinding {
  pack: string;
  level: 'error' | 'info';
  code: string;
  message: string;
}

/** The release fields a version pins (formulas are derived from them). */
const pinned = (r: PackRelease) =>
  JSON.stringify({
    manifest: r.manifest,
    rules: r.rules,
    content: r.content,
    upgrades: r.upgrades ?? [],
  });

/**
 * The highest published release of a pack whose version satisfies a range (for a previous
 * release's dependencies).
 */
export type PublishedInRange = (pack: BuiltPack, range: string) => PackRelease | undefined;

/**
 * A release's dependencies, transitively, in load order: the pack as built when
 * its version satisfies the range, else the highest published release that does. One that can't
 * be found is left out, and checkRelease reports it as `missing-dependency`.
 */
function dependenciesOf(
  release: PackRelease,
  built: BuiltPack[],
  inRange: PublishedInRange,
): PackRelease[] {
  const out = new Map<string, PackRelease>();
  const visit = (r: PackRelease) => {
    for (const [id, range] of Object.entries(r.manifest.dependencies ?? {})) {
      if (out.has(id)) continue;
      const pack = built.find((p) => p.id === id);
      if (!pack) continue;
      const found = semver.satisfies(pack.release.manifest.version, range)
        ? pack.release
        : inRange(pack, range);
      if (!found) continue;
      out.set(id, found);
      visit(found);
    }
  };
  visit(release);
  return [...out.values()].toReversed();
}

export function releaseCheck(
  built: BuiltPack[],
  published: (pack: BuiltPack) => PublishedReleases,
  inRange: PublishedInRange = () => undefined,
): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];
  for (const pack of built) {
    const { same, previous } = published(pack);
    const version = pack.release.manifest.version;
    if (same) {
      if (pinned(same) !== pinned(pack.release)) {
        findings.push({
          pack: pack.id,
          level: 'error',
          code: 'published-version-changed',
          message: `${pack.id} ${version} is already published, and the pack has changed since. Bump its version (pnpm changeset).`,
        });
      }
      continue;
    }
    if (!previous) {
      findings.push({
        pack: pack.id,
        level: 'info',
        code: 'first-release',
        message: `${pack.id} ${version}: no earlier release; nothing to compare.`,
      });
      continue;
    }
    const dependencies: ReleaseDependencies = {
      previous: dependenciesOf(previous, built, inRange),
      next: dependenciesOf(pack.release, built, inRange),
    };
    const result = checkRelease(previous, pack.release, dependencies);
    for (const error of result.errors) {
      findings.push({
        pack: pack.id,
        level: 'error',
        code: error.code,
        message: `${pack.id} ${previous.manifest.version} → ${version}: ${error.code} ${JSON.stringify(error.data ?? {})}`,
      });
    }
    if (result.ok) {
      findings.push({
        pack: pack.id,
        level: 'info',
        code: 'ok',
        message: `${pack.id} ${previous.manifest.version} → ${version}: ${result.changes.length} shape change(s), covered.`,
      });
    }
  }
  return findings;
}

/** Published releases from git tags (`<package name>@<version>`, as Changesets tags them). */
export function publishedFromGit(root: string): (pack: BuiltPack) => PublishedReleases {
  return (pack) => {
    const name = `@opencharacter/${pack.id}`;
    const tags = execFileSync('git', ['tag', '--list', `${name}@*`], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .map((tag) => ({ tag, version: tag.slice(name.length + 1) }))
      .filter((t) => semver.valid(t.version));
    const version = pack.release.manifest.version;
    const same = tags.find((t) => t.version === version);
    const lower = tags
      .filter((t) => semver.lt(t.version, version))
      .toSorted((a, b) => semver.rcompare(a.version, b.version))[0];
    return {
      ...(same ? { same: releaseAt(root, same.tag, pack.dir) } : {}),
      ...(lower ? { previous: releaseAt(root, lower.tag, pack.dir) } : {}),
    };
  };
}

/** The highest published release (git tag) of a pack whose version satisfies a range. */
export function publishedInRangeFromGit(root: string): PublishedInRange {
  return (pack, range) => {
    const name = `@opencharacter/${pack.id}`;
    const best = execFileSync('git', ['tag', '--list', `${name}@*`], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .map((tag) => ({ tag, version: tag.slice(name.length + 1) }))
      .filter((t) => semver.valid(t.version) && semver.satisfies(t.version, range))
      .toSorted((a, b) => semver.rcompare(a.version, b.version))[0];
    return best ? releaseAt(root, best.tag, pack.dir) : undefined;
  };
}

function releaseAt(root: string, tag: string, packDir: string): PackRelease {
  const tmp = mkdtempSync(join(tmpdir(), 'ocf-release-'));
  try {
    const rel = relative(root, packDir);
    const archive = execFileSync('git', ['archive', '--format=tar', tag, rel], {
      cwd: root,
      maxBuffer: 1 << 30,
    });
    execFileSync('tar', ['-x', '-C', tmp], { input: archive });
    const pack = loadPack(join(tmp, rel), tmp, new SchemaValidator(), new Reporter());
    if (!pack) throw new Error(`could not read ${rel} at ${tag}`);
    return buildRelease({
      manifest: pack.manifest,
      rules: pack.rules.map((r) => r.doc),
      content: pack.content.map((c) => c.doc),
      upgrades: pack.upgrades.map((u) => u.doc),
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export interface PackBump {
  id: string;
  from: string;
  to: string;
}

/**
 * After `changeset version` bumps package.json versions, copies each pack's package.json version
 * into its pack.yaml (pack.yaml's version is what characters pin). Returns the packs changed.
 */
export function syncPackVersions(packsDir: string): PackBump[] {
  const bumps: PackBump[] = [];
  for (const game of readdirSync(packsDir, { withFileTypes: true }).filter((e) =>
    e.isDirectory(),
  )) {
    for (const entry of readdirSync(join(packsDir, game.name), { withFileTypes: true }).filter(
      (e) => e.isDirectory(),
    )) {
      const dir = join(packsDir, game.name, entry.name);
      const manifest = join(dir, 'pack.yaml');
      const pkg = join(dir, 'package.json');
      if (!existsSync(manifest) || !existsSync(pkg)) continue;
      const to = (JSON.parse(readFileSync(pkg, 'utf8')) as { version: string }).version;
      const text = readFileSync(manifest, 'utf8');
      const id = /^id: *(\S+)/m.exec(text)?.[1];
      const from = /^version: *(\S+)/m.exec(text)?.[1];
      if (!id || !from || from === to) continue;
      writeFileSync(manifest, text.replace(/^version: .*$/m, `version: ${to}`));
      bumps.push({ id, from, to });
    }
  }
  return bumps;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Only pins of the old version move, so an upgrade test's pin of another version stays. */
export function syncPinnedVersions(root: string, files: string[], bumps: PackBump[]): string[] {
  const patterns = bumps.flatMap(({ id, from, to }) => {
    const q = `['"]?`;
    return [
      {
        re: new RegExp(
          `(${q}id${q}: *${q}${escape(id)}${q}, *${q}version${q}: *${q})${escape(from)}(?![\\w.-])`,
          'g',
        ),
        to,
      },
      {
        re: new RegExp(
          `(^([ \\t]*)- id: *${q}${escape(id)}${q}[ \\t]*\\r?\\n\\2  version: *${q})${escape(from)}(?![\\w.-])`,
          'gm',
        ),
        to,
      },
    ];
  });
  const changed: string[] = [];
  for (const file of files) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    let next = text;
    for (const { re, to } of patterns) next = next.replace(re, `$1${to}`);
    if (next !== text) {
      writeFileSync(path, next);
      changed.push(file);
    }
  }
  return changed;
}

export interface SpecBump {
  from: string;
  to: string;
}

const SPEC_SOURCE = 'packages/spec/src/index.ts';
const majorMinor = (v: string) => v.split('.').slice(0, 2).join('.');

/**
 * After `changeset version` bumps `@opencharacter/spec`, moves the spec version everywhere it is
 * stated: `SPEC_VERSION` (which `SCHEMA_BASE` derives from), the `schemas/<major.minor>/` path of
 * every schema ID and link, and the prose that names the current version. Minimums and records
 * (`specVersion`) stay. Returns the bump and the files changed, or undefined when they match.
 */
export function syncSpecVersion(
  root: string,
  files: string[],
): { bump: SpecBump; files: string[] } | undefined {
  const pkg = join(root, 'packages', 'spec', 'package.json');
  const to = (JSON.parse(readFileSync(pkg, 'utf8')) as { version: string }).version;
  const source = readFileSync(join(root, SPEC_SOURCE), 'utf8');
  const from = /SPEC_VERSION = '([^']+)'/.exec(source)?.[1];
  if (!from) throw new Error(`no SPEC_VERSION in ${SPEC_SOURCE}`);
  if (from === to) return undefined;
  const patterns: [RegExp, string][] = [
    [new RegExp(`(SPEC_VERSION = ')${escape(from)}'`, 'g'), `$1${to}'`],
    [
      new RegExp(
        `(Spec version \\**|current version is \\**)${escape(from)}(?![\\w-]|\\.\\d)`,
        'g',
      ),
      `$1${to}`,
    ],
  ];
  if (majorMinor(from) !== majorMinor(to)) {
    patterns.push([
      new RegExp(`(?<![\\w.-])schemas/${escape(majorMinor(from))}/`, 'g'),
      `schemas/${majorMinor(to)}/`,
    ]);
  }
  const changed: string[] = [];
  for (const file of new Set([SPEC_SOURCE, ...files])) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    let next = text;
    for (const [re, sub] of patterns) next = next.replace(re, sub);
    if (next !== text) {
      writeFileSync(path, next);
      changed.push(file);
    }
  }
  return { bump: { from, to }, files: changed };
}

export function pinFiles(root: string): string[] {
  return execFileSync(
    'git',
    [
      'ls-files',
      '--',
      ':!packs/*/*/content',
      ':!packs/*/*/rules',
      ':!packs/*/*/i18n',
      ':!packs/*/*/upgrades',
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\n')
    .filter(
      (f) =>
        /\.(ya?ml|md|mdx|ts|js|mjs|json)$/.test(f) &&
        !/(^|\/)CHANGELOG\.md$/.test(f) &&
        !/^packs\/[^/]+\/[^/]+\/(pack\.yaml|package\.json)$/.test(f) &&
        !/(^|\/)(node_modules|dist)\//.test(f),
    );
}
