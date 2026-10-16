import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { loadSchemas, SCHEMA_BASE } from '../../packages/spec/src/node.ts';
import { expandFamilies } from '../../packages/engine/src/core/families.ts';
import type { Reporter } from './report.ts';
import type {
  CharacterDoc,
  ContentItem,
  I18nDoc,
  PackManifest,
  RulesDoc,
  UpgradeDoc,
} from './types.ts';

export interface SourceFile<T> {
  file: string;
  doc: T;
  /** A rules document as written, before its families were expanded. */
  raw?: T;
}

/**
 * The families each pack's keys expand over, by pack ID: its own and its
 * dependencies' by name (its own first), with their declared values. Other packs' additions
 * don't expand keys; formulas read them (`keysOf`, `fieldOf`).
 */
export function visibleFamilies(
  dirs: string[],
  cache: YamlCache,
): Map<string, Map<string, string[]>> {
  const packs = new Map<string, { deps: string[]; families: Record<string, unknown[]>[] }>();
  for (const dir of dirs) {
    const manifest = cache.read(join(dir, 'pack.yaml')).doc as PackManifest | undefined;
    if (!manifest || typeof manifest.id !== 'string') continue;
    const families = walkYaml(join(dir, 'rules')).flatMap((file) => {
      const doc = cache.read(file).doc as RulesDoc | undefined;
      return doc && typeof doc === 'object' && doc.families ? [doc.families] : [];
    });
    packs.set(manifest.id, { deps: Object.keys(manifest.dependencies ?? {}), families });
  }
  const declared = new Map<string, string[]>();
  for (const [pid, p] of packs)
    for (const set of p.families)
      for (const [name, values] of Object.entries(set))
        if (!name.includes(':') && Array.isArray(values))
          declared.set(`${pid}:${name}`, values.map(String));
  const scope = (pid: string, order: string[] = []): string[] => {
    if (order.includes(pid)) return order;
    order.push(pid);
    for (const dep of packs.get(pid)?.deps ?? []) scope(dep, order);
    return order;
  };
  const out = new Map<string, Map<string, string[]>>();
  for (const pid of packs.keys()) {
    const visible = new Map<string, string[]>();
    for (const scoped of scope(pid).toReversed())
      for (const [qid, values] of declared)
        if (qid.startsWith(`${scoped}:`)) visible.set(qid.slice(scoped.length + 1), values);
    out.set(pid, visible);
  }
  return out;
}

export interface LoadedPack {
  dir: string;
  manifest: PackManifest;
  rules: SourceFile<RulesDoc>[];
  content: SourceFile<ContentItem>[];
  i18n: Map<string, SourceFile<I18nDoc>[]>;
  upgrades: SourceFile<UpgradeDoc>[];
}

export type SchemaName =
  | 'pack'
  | 'rules'
  | 'content-item'
  | 'i18n'
  | 'upgrade'
  | 'character'
  | 'change';

export class SchemaValidator {
  private readonly validators = new Map<SchemaName, ValidateFunction>();

  constructor() {
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
    addFormats.default(ajv);
    for (const schema of loadSchemas().values()) ajv.addSchema(schema);
    for (const name of [
      'pack',
      'rules',
      'content-item',
      'i18n',
      'upgrade',
      'character',
      'change',
    ] as const) {
      const fn = ajv.getSchema(`${SCHEMA_BASE}${name}.schema.json`);
      if (!fn) throw new Error(`schema ${name} not found`);
      this.validators.set(name, fn);
    }
  }

  check(name: SchemaName, doc: unknown, file: string, report: Reporter): boolean {
    const fn = this.validators.get(name);
    if (!fn) throw new Error(`schema ${name} not loaded`);
    if (fn(doc)) return true;
    for (const error of simplify(fn.errors ?? [])) {
      report.error(file, `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`);
    }
    return false;
  }
}

/**
 * Ajv reports every failing branch of anyOf/oneOf/if-then. Keep the most specific errors:
 * drop combinator summaries when a deeper error explains them.
 */
function simplify(errors: ErrorObject[]): ErrorObject[] {
  const combinators = new Set(['anyOf', 'oneOf', 'if', 'allOf']);
  const specific = errors.filter((e) => !combinators.has(e.keyword));
  const chosen = specific.length > 0 ? specific : errors;
  const seen = new Set<string>();
  return chosen.filter((e) => {
    const key = `${e.instancePath} ${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A parsed file, or its parse error, as of one version of the file on disk. */
interface CacheEntry {
  version: string;
  doc?: unknown;
  error?: string;
}

/** A file's version on disk: changes whenever the file is written, replaced or resized. */
export function fileVersion(file: string): string {
  const s = statSync(file, { bigint: true });
  return `${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;
}

/**
 * Parsed YAML files kept across validation runs, so a run after an editor save parses
 * only the files that changed. Each entry is keyed by the file's path and checked against its
 * inode, size, modification and change times. Cached documents are shared between runs, so
 * they are deep-frozen: code that tried to change one would throw rather than corrupt the
 * next run.
 */
export class YamlCache {
  private entries = new Map<string, CacheEntry>();
  private used = new Set<string>();

  read(file: string): CacheEntry {
    const version = fileVersion(file);
    this.used.add(file);
    const cached = this.entries.get(file);
    if (cached?.version === version) return cached;
    let entry: CacheEntry;
    try {
      entry = { version, doc: deepFreeze(parse(readFileSync(file, 'utf8'), { uniqueKeys: true })) };
    } catch (error) {
      entry = { version, error: (error as Error).message };
    }
    this.entries.set(file, entry);
    return entry;
  }

  /** Forgets the files not read since the last prune (deleted, moved or no longer walked). */
  prune(): void {
    for (const file of this.entries.keys()) if (!this.used.has(file)) this.entries.delete(file);
    this.used.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

export function readYaml(
  file: string,
  report: Reporter,
  root: string,
  cache: YamlCache = new YamlCache(),
): unknown {
  const entry = cache.read(file);
  if (entry.error === undefined) return entry.doc;
  report.error(relative(root, file), `YAML parse error: ${entry.error}`);
  return undefined;
}

export function walkYaml(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walkYaml(path);
      return entry.name.endsWith('.yaml') ? [path] : [];
    })
    .toSorted();
}

export function contentIdFromPath(contentDir: string, file: string): string {
  return relative(contentDir, file)
    .replace(/\.yaml$/, '')
    .split(sep)
    .join('.');
}

export function loadPack(
  dir: string,
  root: string,
  schemas: SchemaValidator,
  report: Reporter,
  cache: YamlCache = new YamlCache(),
  /** The families the pack sees (`visibleFamilies`); else only its own. */
  families?: Map<string, Map<string, string[]>>,
): LoadedPack | undefined {
  const rel = (file: string) => relative(root, file);
  const manifestFile = join(dir, 'pack.yaml');
  const manifest = readYaml(manifestFile, report, root, cache);
  // Keep checking the rest of a pack whose manifest has problems, as long as it has an id.
  const manifestOk = schemas.check('pack', manifest, rel(manifestFile), report);
  if (!manifestOk && typeof (manifest as { id?: unknown } | undefined)?.id !== 'string') {
    return undefined;
  }
  const pack: LoadedPack = {
    dir: relative(root, dir),
    manifest: manifest as PackManifest,
    rules: [],
    content: [],
    i18n: new Map(),
    upgrades: [],
  };

  const expectedId = `${basename(dirname(dir))}-${basename(dir)}`;
  if (pack.manifest.id !== expectedId) {
    report.error(
      rel(manifestFile),
      `pack id "${pack.manifest.id}" must be "${expectedId}" (<game folder>-<pack folder>)`,
    );
  }

  const packageFile = join(dir, 'package.json');
  if (existsSync(packageFile)) {
    const pkg = JSON.parse(readFileSync(packageFile, 'utf8')) as {
      name?: string;
      version?: string;
    };
    if (pkg.name !== `@opencharacter/${pack.manifest.id}`) {
      report.error(rel(packageFile), `package name must be "@opencharacter/${pack.manifest.id}"`);
    }
    if (pkg.version !== pack.manifest.version) {
      report.error(
        rel(packageFile),
        `package version ${pkg.version} must equal pack.yaml version ${pack.manifest.version}`,
      );
    }
  }

  // Field families and shared view fields are expanded before the schema check
  // and everything after it, which read the fields they stand for. The expanded documents keep
  // their file; their family keys and `families` are gone.
  const rulesFiles = walkYaml(join(dir, 'rules')).flatMap((file) => {
    const doc = readYaml(file, report, root, cache);
    return doc !== null && typeof doc === 'object' && !Array.isArray(doc)
      ? [{ file: rel(file), doc: doc as RulesDoc } as SourceFile<RulesDoc>]
      : doc === undefined
        ? []
        : (schemas.check('rules', doc, rel(file), report), []);
  });
  const visible = families?.get(pack.manifest.id);
  const shorthand =
    (visible !== undefined && visible.size > 0) ||
    rulesFiles.some((r) => r.doc.families !== undefined || r.doc.viewFields !== undefined);
  // The documents as written: content's view-field names resolve against them.
  const rulesSource = rulesFiles.map((r) => r.doc);
  if (shorthand) {
    const declaring = rulesFiles.filter((r) => r.doc.families !== undefined);
    for (const r of declaring) {
      const { families: f, viewFields: v } = r.doc;
      schemas.check('rules', { families: f, ...(v ? { viewFields: v } : {}) }, r.file, report);
    }
    try {
      const expanded = expandFamilies(
        rulesFiles.map((r) => r.doc),
        [],
        visible,
      );
      for (const problem of expanded.problems)
        if ('rules' in problem.where)
          report.error(
            rulesFiles[problem.where.rules]?.file ?? pack.dir,
            `invalid-family: ${problem.message}`,
          );
      rulesFiles.forEach((r, i) => {
        r.raw = r.doc;
        r.doc = expanded.rules[i] as RulesDoc;
      });
    } catch (error) {
      report.error(pack.dir, `invalid-family: ${(error as Error).message}`);
    }
  }
  for (const r of rulesFiles) if (schemas.check('rules', r.doc, r.file, report)) pack.rules.push(r);

  const contentDir = join(dir, 'content');
  for (const file of walkYaml(contentDir)) {
    const doc = readYaml(file, report, root, cache);
    if (!schemas.check('content-item', doc, rel(file), report)) continue;
    const item = doc as ContentItem;
    const expected = contentIdFromPath(contentDir, file);
    if (item.id !== undefined && item.id !== expected) {
      report.error(rel(file), `id "${item.id}" must match its path ("${expected}")`);
    }
    pack.content.push({ file: rel(file), doc: item });
  }

  // Content's participant roles may name the pack's view fields.
  if (shorthand) {
    const expanded = expandFamilies(
      rulesSource,
      pack.content.map((c) => c.doc),
      visible,
    );
    for (const problem of expanded.problems)
      if ('content' in problem.where)
        report.error(
          pack.content[problem.where.content]?.file ?? pack.dir,
          `invalid-family: ${problem.message}`,
        );
    pack.content = pack.content.map((c, i) => ({
      ...c,
      raw: c.doc,
      doc: expanded.content[i] as ContentItem,
    }));
  }

  const i18nDir = join(dir, 'i18n');
  if (existsSync(i18nDir)) {
    for (const name of readdirSync(i18nDir).toSorted()) {
      const path = join(i18nDir, name);
      const isDir = statSync(path).isDirectory();
      const language = isDir ? name : name.replace(/\.yaml$/, '');
      const files = isDir ? walkYaml(path) : name.endsWith('.yaml') ? [path] : [];
      for (const file of files) {
        const doc = readYaml(file, report, root, cache);
        if (!schemas.check('i18n', doc ?? {}, rel(file), report)) continue;
        const list = pack.i18n.get(language) ?? [];
        list.push({ file: rel(file), doc: (doc ?? {}) as I18nDoc });
        pack.i18n.set(language, list);
      }
    }
  }

  for (const file of walkYaml(join(dir, 'upgrades'))) {
    const doc = readYaml(file, report, root, cache);
    if (schemas.check('upgrade', doc, rel(file), report)) {
      const upgrade = doc as UpgradeDoc;
      if (upgrade.pack !== pack.manifest.id) {
        report.error(rel(file), `upgrade script is for pack "${upgrade.pack}", not this pack`);
      }
      pack.upgrades.push({ file: rel(file), doc: upgrade });
    }
  }

  return pack;
}

export function loadCharacter(
  file: string,
  root: string,
  schemas: SchemaValidator,
  report: Reporter,
  cache: YamlCache = new YamlCache(),
): SourceFile<CharacterDoc> | undefined {
  const doc = readYaml(file, report, root, cache);
  const rel = relative(root, file);
  return schemas.check('character', doc, rel, report)
    ? { file: rel, doc: doc as CharacterDoc }
    : undefined;
}
