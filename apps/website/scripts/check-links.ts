import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE } from '../site.ts';

// Checks every internal link in the built site: the page exists and, when the link has an anchor,
// the page has an element with that id. Run after `astro build`.

const dist = fileURLToPath(new URL('../dist', import.meta.url));

function html(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return html(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

const ids = new Map<string, Set<string>>();
const idsOf = (file: string) => {
  let set = ids.get(file);
  if (!set) {
    set = new Set(
      [...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] as string),
    );
    ids.set(file, set);
  }
  return set;
};

const broken: string[] = [];
let checked = 0;
for (const file of html(dist)) {
  const page = relative(dist, file);
  for (const match of readFileSync(file, 'utf8').matchAll(/href="([^"]+)"/g)) {
    const href = (match[1] as string).replace(/&amp;/g, '&');
    // Links to the site itself: under the base, not protocol-relative (`//host/…`).
    if (!href.startsWith(`${BASE}/`) || href.startsWith('//')) continue;
    const [path = '', anchor] = href.slice(BASE.length).split('#');
    const clean = decodeURIComponent(path.split('?')[0] as string);
    const target = clean.endsWith('/') ? join(dist, clean, 'index.html') : join(dist, clean);
    checked++;
    if (!existsSync(target)) broken.push(`${page}: ${href} (no such page)`);
    else if (anchor && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(anchor)))
      broken.push(`${page}: ${href} (no #${anchor})`);
  }
}
for (const b of broken) console.error(`broken  ${b}`);
console.log(`checked ${checked} internal links: ${broken.length} broken`);
process.exit(broken.length > 0 ? 1 : 0);
