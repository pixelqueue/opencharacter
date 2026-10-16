import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths } from '../../packages/spec/src/node.ts';
import { generate } from './generate.ts';

export const TYPES_FILE = join(paths.root, 'src', 'types.ts');

const OXFMT = join(paths.root, '..', '..', 'node_modules', '.bin', 'oxfmt');

/** The generated types, formatted as the repo formats TypeScript (oxfmt). */
export function format(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ocf-types-'));
  try {
    const file = join(dir, 'types.ts');
    writeFileSync(file, generate());
    execFileSync(OXFMT, ['--config', join(paths.root, '..', '..', '.oxfmtrc.json'), file], {
      stdio: 'pipe',
    });
    return readFileSync(file, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
