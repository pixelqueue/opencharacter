import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { buildRelease, type PackRelease } from '../src/index.ts';

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

export function readPack(dir: string): PackRelease {
  const manifest = read(join(dir, 'pack.yaml'));
  return buildRelease({
    manifest,
    rules: yamlFiles(join(dir, 'rules')).map(read),
    content: yamlFiles(join(dir, 'content')).map(read),
  });
}
