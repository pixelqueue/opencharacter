import { fileURLToPath } from 'node:url';
import { pinFiles, syncPackVersions, syncPinnedVersions } from './index.ts';

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
}
