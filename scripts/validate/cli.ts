import { fileURLToPath } from 'node:url';
import { validateRepo } from './index.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { reporter, packs, characters } = validateRepo(root);

for (const { file, message } of reporter.warnings) console.warn(`warning  ${file}: ${message}`);
for (const { file, message } of reporter.errors) console.error(`error    ${file}: ${message}`);

console.log(
  `\nValidated ${packs.length} pack(s) [${packs.join(', ')}] and ${characters.length} character file(s): ` +
    `${reporter.errors.length} error(s), ${reporter.warnings.length} warning(s).`,
);
process.exit(reporter.errors.length > 0 ? 1 : 0);
