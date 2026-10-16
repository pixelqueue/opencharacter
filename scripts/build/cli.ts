import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildPacks, writePacksBundle, writePack, writeSpecText } from './index.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { reporter, built } = buildPacks(root);
for (const { file, message } of reporter.errors) console.error(`error    ${file}: ${message}`);
if (reporter.errors.length > 0) {
  console.error('\nThe packs are not valid; nothing was built (see pnpm validate).');
  process.exit(1);
}
const problems = built.flatMap(writePack);
for (const problem of problems) console.error(`error    ${problem}`);
writePacksBundle(root, built);
// The spec's standard text, as packs ship their default language.
const languages = writeSpecText(join(root, 'packages', 'spec'));
console.log(`built @opencharacter/spec text: languages ${languages.join(', ')}`);
for (const pack of built) {
  console.log(
    `built ${pack.id} ${pack.release.manifest.version}: ${pack.release.content.length} items, ${Object.keys(pack.release.formulas).length} formulas, languages ${Object.keys(pack.i18n).join(', ')}`,
  );
}
process.exit(problems.length > 0 ? 1 : 0);
