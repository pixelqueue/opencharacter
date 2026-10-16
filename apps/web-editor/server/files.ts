import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { isMap, parse, parseDocument } from 'yaml';

// File access for the editor. Every path is relative to the repo root and must stay inside
// packs/: the editor never reads or writes anything else.

export class EditorError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Resolves a repo-relative path, refusing anything outside packs/ or not a .yaml file. */
export function packPath(root: string, path: string): string {
  const packs = resolve(root, 'packs');
  const full = resolve(root, path);
  if (full !== packs && !full.startsWith(packs + sep))
    throw new EditorError(403, `outside packs/: ${path}`);
  if (!full.endsWith('.yaml')) throw new EditorError(403, `not a .yaml file: ${path}`);
  return full;
}

export interface TreeNode {
  name: string;
  path?: string;
  children?: TreeNode[];
}

export function tree(root: string): TreeNode[] {
  const walk = (dir: string): TreeNode[] =>
    readdirSync(dir, { withFileTypes: true })
      .filter(
        (e) =>
          (e.isDirectory() && e.name !== 'dist' && e.name !== 'node_modules') ||
          e.name.endsWith('.yaml'),
      )
      .toSorted(
        (a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name),
      )
      .map((e) => {
        const full = join(dir, e.name);
        return e.isDirectory()
          ? { name: e.name, children: walk(full) }
          : { name: e.name, path: relative(root, full).split(sep).join('/') };
      })
      .filter((n) => !n.children || n.children.length > 0);
  return walk(resolve(root, 'packs'));
}

export function readText(root: string, path: string): string {
  const full = packPath(root, path);
  if (!existsSync(full)) throw new EditorError(404, `no such file: ${path}`);
  return readFileSync(full, 'utf8');
}

/** Formats with oxfmt so written files pass `pnpm lint`; falls back to the text as given. */
export function format(root: string, path: string, text: string): string {
  const oxfmt = join(root, 'node_modules', '.bin', 'oxfmt');
  if (!existsSync(oxfmt)) return text;
  try {
    return execFileSync(oxfmt, ['--stdin-filepath', path], {
      input: text,
      encoding: 'utf8',
      cwd: root,
    });
  } catch {
    return text;
  }
}

export function writeText(root: string, path: string, text: string): void {
  const full = packPath(root, path);
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw new EditorError(400, `YAML error: ${doc.errors[0]?.message}`);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, format(root, path, text));
}

export type Patch = Record<string, unknown>;

/** Keep untouched lines as the repo's formatter writes them (`[a, b]`, not `[ a, b ]`). */
const FORMAT = { flowCollectionPadding: false, lineWidth: 0 } as const;

export interface Op {
  path: (string | number)[];
  value?: unknown;
  delete?: boolean;
}

/** Keeps comments and layout. Paths are arrays, so dotted keys (`abilities.str.score`) stay single. */
export function patchYaml(root: string, path: string, ops: Op[]): string {
  const doc = parseDocument(readText(root, path));
  for (const op of ops) {
    if (op.path.length === 0) throw new EditorError(400, 'an op needs a path');
    if (op.delete) doc.deleteIn(op.path);
    else doc.setIn(op.path, doc.createNode(op.value));
  }
  const text = doc.toString(FORMAT);
  writeText(root, path, text);
  return readFileSync(packPath(root, path), 'utf8');
}

export function patchI18n(
  root: string,
  path: string,
  entries: Record<string, string | null>,
): void {
  const full = packPath(root, path);
  const doc = parseDocument(existsSync(full) ? readFileSync(full, 'utf8') : '{}\n');
  if (!isMap(doc.contents)) throw new EditorError(400, `${path} is not a translation map`);
  for (const [key, value] of Object.entries(entries)) {
    // Flat keys contain dots, so address them as single keys, not paths.
    if (value === null || value === '') doc.delete(key);
    else doc.set(key, value);
  }
  writeText(root, path, doc.toString(FORMAT));
}

export function readYaml(root: string, path: string): unknown {
  return parse(readText(root, path));
}

export function isFile(root: string, path: string): boolean {
  try {
    return statSync(packPath(root, path)).isFile();
  } catch {
    return false;
  }
}
