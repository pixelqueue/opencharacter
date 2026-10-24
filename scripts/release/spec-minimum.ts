import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import semver from 'semver';
import type { BuiltPack } from '../build/index.ts';

// A pack's `specVersion` is the minimum spec it needs: packages/spec/docs/versioning.md.

/** A published spec release: what a pack written against it may use. */
export interface SpecRelease {
  version: string;
  /** What in the pack's release this spec doesn't have: schema errors and unknown functions. */
  problems: (pack: BuiltPack) => string[];
}

/** A spec release from its schemas and formula functions. */
export function specRelease(
  version: string,
  schemas: unknown[],
  functions: Iterable<string>,
): SpecRelease {
  const ajv = new Ajv2020({ strict: false, allErrors: false });
  addFormats.default(ajv);
  for (const schema of schemas) ajv.addSchema(schema as object);
  const id = schemas
    .map((s) => (s as { $id?: string }).$id ?? '')
    .find((s) => s.endsWith('/pack-release.schema.json'));
  const validate: ValidateFunction | undefined = id ? ajv.getSchema(id) : undefined;
  if (!validate) throw new Error(`spec ${version}: no pack-release schema`);
  const known = new Set(functions);
  return {
    version,
    problems(pack) {
      const out: string[] = [];
      const { formulas, ...release } = pack.release;
      if (!validate({ ...release, i18n: pack.i18n }))
        for (const e of validate.errors ?? []) {
          const extra = (e.params as { additionalProperty?: string }).additionalProperty;
          out.push(
            `${e.instancePath || '/'} ${e.message ?? 'is invalid'}${extra ? `: ${extra}` : ''}`,
          );
        }
      const fns = new Set<string>();
      const walk = (node: unknown) => {
        if (Array.isArray(node)) node.forEach(walk);
        else if (node && typeof node === 'object') {
          const n = node as Record<string, unknown>;
          if (n.type === 'call' && typeof n.fn === 'string') fns.add(n.fn);
          Object.values(n).forEach(walk);
        }
      };
      for (const f of Object.values(formulas ?? {})) walk(f.tree);
      for (const fn of [...fns].toSorted()) if (!known.has(fn)) out.push(`function ${fn}`);
      return out;
    },
  };
}

/** The published spec releases (git tags `@opencharacter/spec@<version>`), lowest first. */
export function specReleasesFromGit(root: string): SpecRelease[] {
  const name = '@opencharacter/spec';
  return execFileSync('git', ['tag', '--list', `${name}@*`], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((tag) => ({ tag, version: tag.slice(name.length + 1) }))
    .filter((t) => semver.valid(t.version))
    .toSorted((a, b) => semver.compare(a.version, b.version))
    .map(({ tag, version }) => specAt(root, tag, version));
}

function specAt(root: string, tag: string, version: string): SpecRelease {
  const tmp = mkdtempSync(join(tmpdir(), 'ocf-spec-'));
  try {
    const archive = execFileSync(
      'git',
      [
        'archive',
        '--format=tar',
        tag,
        'packages/spec/schemas',
        'packages/spec/data/formula-context.json',
      ],
      { cwd: root, maxBuffer: 1 << 30 },
    );
    execFileSync('tar', ['-x', '-C', tmp], { input: archive });
    const schemas: unknown[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (entry.endsWith('.schema.json'))
          schemas.push(JSON.parse(readFileSync(path, 'utf8')));
      }
    };
    walk(join(tmp, 'packages/spec/schemas'));
    const context = JSON.parse(
      readFileSync(join(tmp, 'packages/spec/data/formula-context.json'), 'utf8'),
    ) as { functions: { id: string }[] };
    return specRelease(
      version,
      schemas,
      context.functions.map((f) => f.id),
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export interface SpecNeed {
  /** The lowest spec version the pack's release is valid under. */
  version: string;
  /** What the declared spec version lacks. */
  problems: string[];
}

/**
 * The spec version a pack needs when its declared `specVersion` is too low: the lowest
 * published spec it is valid under, else `current` (the spec in this tree). Undefined when the
 * declared version is enough, or no published spec at or below it can check it.
 */
export function specNeed(
  pack: BuiltPack,
  specs: SpecRelease[],
  current: string,
): SpecNeed | undefined {
  const declared = pack.release.manifest.specVersion;
  if (semver.gte(declared, current)) return undefined;
  const base = specs.filter((s) => semver.lte(s.version, declared)).at(-1);
  if (!base) return undefined;
  const problems = base.problems(pack);
  if (problems.length === 0) return undefined;
  const later = specs.find(
    (s) =>
      semver.gt(s.version, declared) &&
      semver.lt(s.version, current) &&
      s.problems(pack).length === 0,
  );
  return { version: later?.version ?? current, problems };
}

/**
 * Sets each pack's `specVersion` in its pack.yaml to the spec version it needs, where the declared
 * one is too low (`current`: the spec version being released). Returns the packs changed.
 */
export function syncPackSpecVersions(
  built: BuiltPack[],
  specs: SpecRelease[],
  current: string,
): { id: string; from: string; to: string }[] {
  const changed: { id: string; from: string; to: string }[] = [];
  for (const pack of built) {
    const need = specNeed(pack, specs, current);
    if (!need) continue;
    const file = join(pack.dir, 'pack.yaml');
    const text = readFileSync(file, 'utf8');
    const next = text.replace(/^specVersion: .*$/m, `specVersion: ${need.version}`);
    if (next === text) continue;
    writeFileSync(file, next);
    changed.push({ id: pack.id, from: pack.release.manifest.specVersion, to: need.version });
  }
  return changed;
}
