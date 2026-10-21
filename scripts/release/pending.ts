import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assembleReleasePlan } from '@changesets/assemble-release-plan';
import { validateConfig } from '@changesets/config';
import { parseChangesetFile } from '@changesets/parse';
import type { NewChangeset, PreState } from '@changesets/types';
import { getPackagesSync } from '@manypkg/get-packages';

const SCOPE = '@opencharacter/';

/**
 * The versions pending changesets will give each package (`pnpm version-packages`), by package
 * name without the `@opencharacter/` scope (a pack's ID): the Changesets release plan, read
 * synchronously so the validator can use it. Empty when no changeset is pending.
 */
export function pendingVersions(root: string): Map<string, string> {
  const dir = join(root, '.changeset');
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md')
    : [];
  if (files.length === 0) return new Map();
  const changesets: NewChangeset[] = files.map((f) => ({
    id: f.slice(0, -'.md'.length),
    ...parseChangesetFile(readFileSync(join(dir, f), 'utf8')),
  }));
  const packages = getPackagesSync(root);
  const parsed = validateConfig(
    JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')) as unknown,
    packages,
  );
  if (!parsed.config) throw new Error(`.changeset/config.json: ${parsed.errors.join('; ')}`);
  const pre = join(dir, 'pre.json');
  const preState = existsSync(pre)
    ? (JSON.parse(readFileSync(pre, 'utf8')) as PreState)
    : undefined;
  const plan = assembleReleasePlan(changesets, packages, parsed.config, preState);
  return new Map(
    plan.releases.flatMap((r): [string, string][] =>
      r.type !== 'none' && r.newVersion && r.name.startsWith(SCOPE)
        ? [[r.name.slice(SCOPE.length), r.newVersion]]
        : [],
    ),
  );
}
