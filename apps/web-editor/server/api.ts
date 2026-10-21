import { execFileSync } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse } from 'yaml';
import { buildRelease, computeSheet, loadRuleset } from '../../../packages/engine/src/index.ts';
import { validateRepo } from '../../../scripts/validate/index.ts';
import { contentIdFromPath, i18nFiles, readI18n } from '../../../scripts/validate/load.ts';
import { loadSchemas } from '../../../packages/spec/src/node.ts';
import {
  EditorError,
  isFile,
  type Op,
  packPath,
  patchI18n,
  patchYaml,
  readText,
  readYaml,
  tree,
  writeText,
} from './files.ts';

// The editor's local API, served by the Vite dev server (localhost only).

type Json = Record<string, unknown>;

interface PackInfo {
  id: string;
  dir: string;
  defaultLanguage: string;
}

function packs(root: string): PackInfo[] {
  return validateRepo(root).loaded.map((p) => ({
    id: p.manifest.id,
    dir: p.dir.split(sep).join('/'),
    defaultLanguage: p.manifest.defaultLanguage,
  }));
}

function packOf(root: string, path: string): PackInfo {
  const pack = packs(root).find((p) => path.startsWith(`${p.dir}/`));
  if (!pack) throw new EditorError(404, `not inside a pack: ${path}`);
  return pack;
}

function validate(root: string) {
  const { reporter } = validateRepo(root);
  const rel = (f: string) => (f.startsWith('/') ? relative(root, f) : f).split(sep).join('/');
  return {
    errors: reporter.errors.map((e) => ({ file: rel(e.file), message: e.message })),
    warnings: reporter.warnings.map((e) => ({ file: rel(e.file), message: e.message })),
  };
}

/** An item file with what the form needs: its content type's declarations and its text. */
function item(root: string, path: string): Json {
  const pack = packOf(root, path);
  const doc = readYaml(root, path) as Json;
  const { loaded } = validateRepo(root);
  const loadedPack = loaded.find((p) => p.manifest.id === pack.id);
  const typeName = typeof doc.type === 'string' ? doc.type : undefined;
  // Content types are looked up in the pack and its dependencies, local names first.
  let contentType: unknown;
  const scope = [pack.id, ...Object.keys(loadedPack?.manifest.dependencies ?? {})];
  for (const id of scope) {
    const p = loaded.find((l) => l.manifest.id === id);
    for (const r of p?.rules ?? []) {
      const name = typeName?.includes(':') ? typeName.split(':')[1] : typeName;
      if (name && r.doc.contentTypes?.[name]) contentType = r.doc.contentTypes[name];
    }
  }
  const i18n = readI18n(join(root, pack.dir), pack.defaultLanguage);
  const id = typeof doc.id === 'string' ? doc.id : '';
  return {
    path,
    pack: pack.id,
    doc,
    text: readText(root, path),
    contentType: contentType ?? null,
    contentTypes: loadedPack
      ? Object.keys(Object.assign({}, ...loadedPack.rules.map((r) => r.doc.contentTypes ?? {})))
      : [],
    i18n: { name: i18n[`${id}.name`] ?? '', description: i18n[`${id}.description`] ?? '' },
  };
}

function kindOf(path: string): 'pack' | 'rules' | 'item' | 'upgrade' | 'i18n' | 'other' {
  if (path.endsWith('/pack.yaml')) return 'pack';
  if (/\/rules\//.test(path)) return 'rules';
  if (/\/content\//.test(path)) return 'item';
  if (/\/upgrades\//.test(path)) return 'upgrade';
  if (/\/i18n\//.test(path)) return 'i18n';
  return 'other';
}

const SCHEMAS = {
  pack: 'pack.schema.json',
  rules: 'rules.schema.json',
  item: 'content-item.schema.json',
  upgrade: 'upgrade.schema.json',
} as const;

/** The JSON Schema `$id` a file is written against (null: no form). */
function schemaFor(path: string): string | null {
  const kind = kindOf(path);
  return kind in SCHEMAS
    ? `https://opencharacterformat.org/schemas/0.1/${SCHEMAS[kind as keyof typeof SCHEMAS]}`
    : null;
}

interface TranslationFile {
  path: string;
  entries: Record<string, string>;
}

function translationFiles(root: string, pack: PackInfo): Map<string, TranslationFile[]> {
  const out = new Map<string, TranslationFile[]>();
  for (const [language, files] of i18nFiles(join(root, pack.dir))) {
    out.set(
      language,
      files.map((file) => ({
        path: relative(root, file).split(sep).join('/'),
        entries: (parse(readFileSync(file, 'utf8')) ?? {}) as Record<string, string>,
      })),
    );
  }
  return out;
}

/** The translations table: every key in any language, plus the keys the default language needs. */
function translations(root: string, packId: string): Json {
  const pack = packs(root).find((p) => p.id === packId);
  if (!pack) throw new EditorError(404, `no pack ${packId}`);
  const files = translationFiles(root, pack);
  const required = validateRepo(root).requiredKeys.get(packId) ?? new Set<string>();
  const languages = [
    pack.defaultLanguage,
    ...[...files.keys()].filter((l) => l !== pack.defaultLanguage).toSorted(),
  ];
  const keys = new Set<string>(required);
  for (const list of files.values())
    for (const file of list) for (const key of Object.keys(file.entries)) keys.add(key);
  const rows = [...keys].toSorted().map((key) => ({
    key,
    required: required.has(key),
    values: Object.fromEntries(
      languages.map((l) => [
        l,
        (files.get(l) ?? []).find((f) => key in f.entries)?.entries[key] ?? null,
      ]),
    ),
  }));
  return { pack: packId, defaultLanguage: pack.defaultLanguage, languages, rows };
}

/** Writes translation entries: a key goes to the file of that language that has it, else the main file. */
function writeTranslations(
  root: string,
  packId: string,
  language: string,
  entries: Record<string, string | null>,
): void {
  const pack = packs(root).find((p) => p.id === packId);
  if (!pack) throw new EditorError(404, `no pack ${packId}`);
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language))
    throw new EditorError(400, `not a language tag: ${language}`);
  const files = translationFiles(root, pack).get(language) ?? [];
  const single = `${pack.dir}/i18n/${language}.yaml`;
  const main = files.some((f) => f.path === single) ? single : (files[0]?.path ?? single);
  const byFile = new Map<string, Record<string, string | null>>();
  for (const [key, value] of Object.entries(entries)) {
    const file = files.find((f) => key in f.entries)?.path ?? main;
    byFile.set(file, { ...byFile.get(file), [key]: value });
  }
  for (const [file, changes] of byFile) patchI18n(root, file, changes);
}

function git(root: string): Json {
  const run = (args: string[]) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    } catch {
      return '';
    }
  };
  const status = run(['status', '--porcelain', '--', 'packs'])
    .split('\n')
    .filter(Boolean)
    .map((line) => ({ status: line.slice(0, 2).trim(), path: line.slice(3) }));
  const diff = run(['diff', '--', 'packs']);
  return {
    status,
    diff: diff.length > 200_000 ? `${diff.slice(0, 200_000)}\n… (truncated)` : diff,
  };
}

function characters(root: string): string[] {
  const dir = join(root, 'examples', 'characters');
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.yaml'))
        .toSorted()
    : [];
}

function preview(root: string, name: string): Json {
  if (!characters(root).includes(name)) throw new EditorError(404, `no example character ${name}`);
  const character = parse(readFileSync(join(root, 'examples', 'characters', name), 'utf8'));
  const { loaded, reporter } = validateRepo(root);
  const pinned = new Set((character.packs as { id: string }[]).map((p) => p.id));
  const add = (id: string) => {
    pinned.add(id);
    for (const dep of Object.keys(
      loaded.find((p) => p.manifest.id === id)?.manifest.dependencies ?? {},
    ))
      if (!pinned.has(dep)) add(dep);
  };
  // Iterating a Set visits members added during the loop, so dependencies are followed too.
  for (const id of pinned) add(id);
  const loadedRuleset = loadRuleset(
    loaded
      .filter((p) => pinned.has(p.manifest.id))
      .map((p) =>
        buildRelease({
          manifest: p.manifest,
          rules: p.rules.map((r) => r.doc),
          content: p.content.map((c) => c.doc),
          upgrades: p.upgrades.map((u) => u.doc),
        }),
      ),
  );
  if (!loadedRuleset.ok)
    return { ok: false, errors: loadedRuleset.errors, validation: reporter.errors.length };
  const sheet = computeSheet(loadedRuleset.ruleset, character);
  return {
    ok: true,
    values: sheet.values,
    issues: sheet.issues,
    pending: sheet.pending,
    errors: sheet.errors,
    validation: reporter.errors.length,
  };
}

async function body(req: IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? (JSON.parse(text) as Json) : {};
}

/** Handles one /api request; returns false when the URL isn't an API route. */
export async function handle(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return false;
  const send = (status: number, data: unknown) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(data));
  };
  try {
    const route = `${req.method} ${url.pathname}`;
    const path = url.searchParams.get('path') ?? '';
    switch (route) {
      case 'GET /api/tree':
        return (send(200, { tree: tree(root), packs: packs(root) }), true);
      case 'GET /api/file':
        return (send(200, { path, text: readText(root, path) }), true);
      case 'PUT /api/file': {
        const b = await body(req);
        writeText(root, String(b.path), String(b.text));
        return (send(200, { ok: true, validation: validate(root) }), true);
      }
      case 'GET /api/item':
        return (send(200, item(root, path)), true);
      case 'PUT /api/item': {
        const b = await body(req);
        const target = String(b.path);
        if (b.ops) patchYaml(root, target, b.ops as Op[]);
        if (b.i18n) {
          const pack = packOf(root, target);
          const doc = readYaml(root, target) as Json;
          const names = b.i18n as { name?: string; description?: string };
          writeTranslations(root, pack.id, pack.defaultLanguage, {
            ...(names.name !== undefined ? { [`${doc.id}.name`]: names.name } : {}),
            ...(names.description !== undefined
              ? { [`${doc.id}.description`]: names.description || null }
              : {}),
          });
        }
        return (send(200, { item: item(root, target), validation: validate(root) }), true);
      }
      case 'POST /api/item': {
        const b = await body(req);
        const pack = packs(root).find((p) => p.id === b.pack);
        if (!pack) throw new EditorError(404, `no pack ${String(b.pack)}`);
        const id = String(b.id ?? '');
        if (!/^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/.test(id))
          throw new EditorError(400, 'an item ID needs a folder and a name, like weapons.dagger');
        const target = `${pack.dir}/content/${id.split('.').join('/')}.yaml`;
        if (isFile(root, target)) throw new EditorError(409, `${target} already exists`);
        if (contentIdFromPath(join(root, pack.dir, 'content'), join(root, target)) !== id)
          throw new EditorError(400, 'ID and path disagree');
        writeText(root, target, `id: ${id}\ntype: ${String(b.type)}\n`);
        if (typeof b.name === 'string' && b.name)
          writeTranslations(root, pack.id, pack.defaultLanguage, { [`${id}.name`]: b.name });
        return (send(201, { path: target, validation: validate(root) }), true);
      }
      case 'GET /api/types': {
        const loaded = validateRepo(root).loaded.find(
          (p) => p.manifest.id === url.searchParams.get('pack'),
        );
        const types = loaded
          ? Object.keys(
              Object.assign({}, ...loaded.rules.map((r) => r.doc.contentTypes ?? {})),
            ).toSorted()
          : [];
        return (send(200, { types }), true);
      }
      case 'GET /api/schemas':
        return (
          send(200, {
            schemas: Object.fromEntries([...loadSchemas().values()].map((sc) => [sc.$id, sc])),
          }),
          true
        );
      case 'GET /api/doc':
        return (
          send(200, {
            path,
            kind: kindOf(path),
            schema: schemaFor(path),
            doc: readYaml(root, path),
            text: readText(root, path),
          }),
          true
        );
      case 'PUT /api/doc': {
        const b = await body(req);
        const target = String(b.path);
        patchYaml(root, target, (b.ops ?? []) as Op[]);
        return (
          send(200, {
            doc: readYaml(root, target),
            text: readText(root, target),
            validation: validate(root),
          }),
          true
        );
      }
      case 'GET /api/i18n':
        return (send(200, translations(root, url.searchParams.get('pack') ?? '')), true);
      case 'PUT /api/i18n': {
        const b = await body(req);
        writeTranslations(
          root,
          String(b.pack),
          String(b.language),
          (b.entries ?? {}) as Record<string, string | null>,
        );
        return (
          send(200, { ...translations(root, String(b.pack)), validation: validate(root) }), true
        );
      }
      case 'GET /api/validate':
        return (send(200, validate(root)), true);
      case 'GET /api/git':
        return (send(200, git(root)), true);
      case 'GET /api/characters':
        return (send(200, { characters: characters(root) }), true);
      case 'GET /api/preview':
        return (send(200, preview(root, url.searchParams.get('character') ?? '')), true);
      default:
        return (send(404, { error: `no route ${route}` }), true);
    }
  } catch (error) {
    if (error instanceof EditorError) return (send(error.status, { error: error.message }), true);
    if (error instanceof SyntaxError) return (send(400, { error: error.message }), true);
    return (send(500, { error: (error as Error).message }), true);
  }
}

export { packPath };
