import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bumpDependencyRanges,
  pinFiles,
  syncDependencyRanges,
  syncPackVersions,
  syncPinnedVersions,
  syncSpecVersion,
} from './index.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const bumps = syncPackVersions(fileURLToPath(new URL('../../packs', import.meta.url)));
if (bumps.length === 0) {
  console.log('pack.yaml versions already match package.json.');
} else {
  console.log(
    `pack.yaml versions updated: ${bumps.map((b) => `${b.id} ${b.from} → ${b.to}`).join(', ')}`,
  );
  const files = syncPinnedVersions(root, pinFiles(root), bumps);
  console.log(
    files.length > 0
      ? `pinned versions updated in ${files.length} file(s).`
      : 'no pinned versions to update.',
  );
  const ranges = syncDependencyRanges(root, pinFiles(root), bumps);
  console.log(
    ranges.length > 0
      ? `dependency ranges updated in ${ranges.length} file(s).`
      : 'no dependency ranges to update.',
  );
  // An official pack's own range is part of its release: it needs its own changeset.
  const manifests = execFileSync('git', ['ls-files', '--', 'packs/*/*/pack.yaml'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  for (const file of manifests) {
    const text = readFileSync(join(root, file), 'utf8');
    if (bumpDependencyRanges(text, bumps) !== text) {
      console.warn(`${file}: a dependency range excludes the new version; add a changeset.`);
    }
  }
}
const spec = syncSpecVersion(root, pinFiles(root));
console.log(
  spec
    ? `spec version ${spec.bump.from} → ${spec.bump.to}: updated ${spec.files.length} file(s).`
    : 'spec version already matches @opencharacter/spec.',
);
for (const id of spec?.upgrades ?? []) {
  console.warn(
    `spec ${id} changes the character file: upgrade the example characters and expected outputs (re-stamped, not migrated).`,
  );
}
