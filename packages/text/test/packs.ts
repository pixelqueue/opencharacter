import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { buildRelease, loadRuleset, type PackRelease } from '@opencharacter/engine';
import { paths } from '@opencharacter/spec/node';
import {
  createText,
  type BlockType,
  type HeadlineItem,
  type Messages,
  type Text,
  type TextOptions,
} from '../src/index.ts';

// Real packs, read from source as the build reads them, and their English text.

export const root = resolve(paths.root, '..', '..');

function yamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .toSorted()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return yamlFiles(path);
      return name.endsWith('.yaml') ? [path] : [];
    });
}

const read = (file: string) => parse(readFileSync(file, 'utf8'));

function readPack(dir: string): PackRelease {
  return buildRelease({
    manifest: read(join(dir, 'pack.yaml')),
    rules: yamlFiles(join(dir, 'rules')).map(read),
    content: yamlFiles(join(dir, 'content')).map(read),
  });
}

/** A pack's English text: `i18n/en.yaml` and `i18n/en/*.yaml`, merged as the build merges them. */
function english(dir: string): Messages {
  const files = [join(dir, 'i18n', 'en.yaml'), ...yamlFiles(join(dir, 'i18n', 'en'))];
  return Object.assign({}, ...files.filter(existsSync).map(read)) as Messages;
}

export function load(...dirs: string[]) {
  const full = dirs.map((d) => join(root, 'packs', d));
  const releases = full.map(readPack);
  const loaded = loadRuleset(releases);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  const en = Object.fromEntries(full.map((dir, i) => [releases[i]!.manifest.id, english(dir)]));
  const spec = read(join(paths.root, 'i18n', 'en.yaml')) as Messages;
  const text: Text = createText({
    languages: ['en'],
    packs: { en },
    spec: { en: spec },
    contentTypes: loaded.ruleset.contentTypes as Record<string, BlockType>,
    content: loaded.ruleset.content as Record<string, HeadlineItem>,
    display: (loaded.ruleset.rules as { display?: TextOptions['display'] }).display,
  });
  return { ruleset: loaded.ruleset, text, en, spec };
}
