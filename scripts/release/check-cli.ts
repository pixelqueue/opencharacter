import { fileURLToPath } from 'node:url';
import { buildPacks } from '../build/index.ts';
import { publishedFromGit, publishedInRangeFromGit, releaseCheck } from './index.ts';
import { SPEC_VERSION } from '../../packages/spec/src/index.ts';
import { pendingVersions } from './pending.ts';
import { specReleasesFromGit } from './spec-minimum.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { reporter, built } = buildPacks(root);
if (reporter.errors.length > 0) {
  console.error('The packs are not valid (see pnpm validate).');
  process.exit(1);
}
const findings = releaseCheck(
  built,
  publishedFromGit(root),
  publishedInRangeFromGit(root),
  pendingVersions(root),
  { releases: specReleasesFromGit(root), version: SPEC_VERSION },
);
for (const f of findings)
  console[f.level === 'error' ? 'error' : 'log'](`${f.level.padEnd(5)}  ${f.message}`);
process.exit(findings.some((f) => f.level === 'error') ? 1 : 0);
