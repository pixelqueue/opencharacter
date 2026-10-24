import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { paths } from '@opencharacter/spec/node';

// Every error and rules-issue code the reference engine can emit is in the spec's fixed
// sets, and every code in those sets has standard English text, so no bare code reaches players.

const src = resolve(import.meta.dirname, '..', 'src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

const ids = (set: string): string[] =>
  (
    JSON.parse(readFileSync(join(paths.data, `${set}.json`), 'utf8')) as {
      items: { id: string }[];
    }
  ).items.map((x) => x.id);

describe('error and issue codes', () => {
  const errors = new Set(ids('error-codes'));
  const issues = new Set(ids('rules-issue-codes'));
  const en = parse(readFileSync(join(paths.i18n, 'en.yaml'), 'utf8')) as Record<string, string>;

  it('every code the engine emits is in a fixed set', () => {
    const emitted = new Set<string>();
    for (const file of sources(src))
      for (const m of readFileSync(file, 'utf8').matchAll(
        /(?:code: |\bfail\(|Failure\()'([a-z]+(?:-[a-z]+)*)'/g,
      ))
        emitted.add(m[1]!);
    expect(emitted.size).toBeGreaterThan(40);
    expect([...emitted].filter((c) => !errors.has(c) && !issues.has(c))).toEqual([]);
  });

  it('every code in the fixed sets has standard text, and so has a code without its own', () => {
    expect([...errors].filter((c) => typeof en[`errors.${c}`] !== 'string')).toEqual([]);
    expect([...issues].filter((c) => typeof en[`issues.${c}`] !== 'string')).toEqual([]);
    // The fallback words any error, so it needs no data; it doesn't show the code to a player.
    expect(en['errors.other']).toMatch(/^[^{}]+$/);
  });

  it('every error the engine emits gives the data its standard text names', () => {
    const missing: string[] = [];
    // A pack check's problem reaches apps only as a load error's `cause`, without data.
    for (const file of sources(src).filter((f) => !f.endsWith(join('check', 'formulas.ts')))) {
      for (const site of emitSites(readFileSync(file, 'utf8'))) {
        const keys = site.keys;
        if (keys === undefined) continue;
        const absent = placeholders(template(en, site.code, keys)).filter((k) => !keys.has(k));
        if (absent.length)
          missing.push(`${relative(src, file)}:${site.line} ${site.code}: ${absent.join(', ')}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every safety limit has its own standard text', () => {
    const limits = ids('safety-limits');
    expect(
      limits.filter((l) => typeof en[`errors.safety-limit-exceeded.${l}`] !== 'string'),
    ).toEqual([]);
  });
});

/** The standard text an error is worded by: `out-of-range` with one bound has its own. */
function template(en: Record<string, string>, code: string, keys: Set<string>): string {
  const bound = keys.has('min') ? 'min' : 'max';
  const variant =
    code === 'out-of-range' && keys.has('min') !== keys.has('max')
      ? en[`errors.out-of-range.${bound}`]
      : undefined;
  return variant ?? en[`errors.${code}`] ?? en[`issues.${code}`] ?? '';
}

function placeholders(message: string): string[] {
  return [...new Set([...message.matchAll(/\{\s*([A-Za-z][\w-]*)\s*[,}]/g)].map((m) => m[1]!))];
}

// Emit sites are read from the source: `fail(code, message, data)`, `ActionError(code, data)`,
// `ChangeError(code, data)`, load's `err(code, data)`, and `{ code, data }` objects.

interface Site {
  code: string;
  line: number;
  /** The data's keys; `undefined` when not written out (a variable or a spread). */
  keys: Set<string> | undefined;
}

const OPEN: Record<string, string> = { '(': ')', '{': '}', '[': ']' };

/** The index just past a string, template or comment starting at `i`, else `i`. */
function skip(text: string, i: number): number {
  const c = text[i];
  if (c === '/' && text[i + 1] === '/') return text.indexOf('\n', i) + 1 || text.length;
  if (c === '/' && text[i + 1] === '*') return text.indexOf('*/', i) + 2;
  if (c === "'" || c === '"') {
    // A quote that isn't a string (in a regex literal) ends at the line's end.
    let j = i + 1;
    while (j < text.length && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
    return j + 1;
  }
  if (c === '`') {
    let j = i + 1;
    while (j < text.length && text[j] !== '`') {
      if (text[j] === '\\') j += 2;
      else if (text[j] === '$' && text[j + 1] === '{') j = close(text, j + 1) + 1;
      else j++;
    }
    return j + 1;
  }
  return i;
}

/** The index of the bracket closing the one at `open`. */
function close(text: string, open: number): number {
  const stack = [OPEN[text[open]!]!];
  let i = open + 1;
  while (stack.length && i < text.length) {
    const next = skip(text, i);
    if (next !== i) {
      i = next;
      continue;
    }
    const c = text[i]!;
    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === stack.at(-1)) stack.pop();
    i++;
  }
  return i - 1;
}

/** The top-level, comma-separated parts between `from` and `to`. */
function parts(text: string, from: number, to: number): string[] {
  const out: string[] = [];
  let start = from;
  let i = from;
  while (i < to) {
    const next = skip(text, i);
    if (next !== i) {
      i = next;
      continue;
    }
    const c = text[i]!;
    if (OPEN[c]) {
      i = close(text, i) + 1;
      continue;
    }
    if (c === ',') {
      out.push(text.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  out.push(text.slice(start, to));
  return out.map((p) => p.trim()).filter(Boolean);
}

/** An object literal's keys (none when absent); `undefined` for anything else, or a spread. */
function objectKeys(expr: string | undefined): Set<string> | undefined {
  if (expr === undefined) return new Set();
  if (!expr.startsWith('{') || close(expr, 0) !== expr.length - 1) return undefined;
  const keys = new Set<string>();
  for (const part of parts(expr, 1, expr.length - 1)) {
    const m = /^['"]?([\w-]+)['"]?\s*(?::|$)/.exec(part);
    if (!m) return undefined;
    keys.add(m[1]!);
  }
  return keys;
}

/** The start of the bracket enclosing `at`. */
function enclosing(text: string, at: number): number {
  let depth = 0;
  for (let i = at; i >= 0; i--) {
    const c = text[i];
    if (c === '}' || c === ')' || c === ']') depth++;
    else if (c === '{' || c === '(' || c === '[') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function emitSites(text: string): Site[] {
  const out: Site[] = [];
  const line = (i: number) => text.slice(0, i).split('\n').length;
  for (const m of text.matchAll(
    /\b(fail|ActionError|ChangeError|err)\(\s*'([a-z]+(?:-[a-z]+)*)'|\bcode: '([a-z]+(?:-[a-z]+)*)'/g,
  )) {
    if (m[1]) {
      const open = text.indexOf('(', m.index);
      const args = parts(text, open + 1, close(text, open));
      const keys = objectKeys(args[m[1] === 'fail' ? 2 : 1]);
      out.push({ code: m[2]!, line: line(m.index), keys });
      continue;
    }
    const start = enclosing(text, m.index);
    if (start < 0 || text[start] !== '{') continue;
    const props = parts(text, start + 1, close(text, start));
    if (props.some((p) => p.startsWith('...'))) continue;
    const data = props.find((p) => /^data\b/.test(p));
    const value = data === undefined ? undefined : data.replace(/^data\s*:?\s*/, '') || 'data';
    out.push({ code: m[3]!, line: line(m.index), keys: objectKeys(value) });
  }
  return out;
}
