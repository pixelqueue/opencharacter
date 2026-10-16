import { fileURLToPath } from 'node:url';
import { syncPackVersions } from './index.ts';

const packs = fileURLToPath(new URL('../../packs', import.meta.url));
const changed = syncPackVersions(packs);
console.log(
  changed.length > 0
    ? `pack.yaml versions updated: ${changed.join(', ')}`
    : 'pack.yaml versions already match package.json.',
);
