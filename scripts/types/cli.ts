import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { format, TYPES_FILE } from './write.ts';

writeFileSync(TYPES_FILE, format());
console.log(`wrote ${relative(process.cwd(), TYPES_FILE)}`);
