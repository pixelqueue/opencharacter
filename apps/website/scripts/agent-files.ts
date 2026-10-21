import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { SPEC_VERSION } from '../../../packages/spec/src/index.ts';
import { readI18n } from '../../../scripts/validate/load.ts';
import { BASE, SITE } from '../site.ts';
import { GUIDE_ORDER, SPEC_ORDER } from './sync-docs.ts';

// Files for agents and crawlers, written into the built site (dist/) after `astro build`:
// - every page as Markdown beside its HTML (`guides/quick-start.md`), its links absolute;
// - llms.txt (https://llmstxt.org): what OCF is and where everything is, as links to that Markdown;
// - llms-full.txt: every guide and spec chapter in reading order, in one file;
// - packs.json: the official packs, as data;
// - robots.txt: everything open, the sitemap and llms.txt named.

const site = fileURLToPath(new URL('..', import.meta.url));
const repo = join(site, '..', '..');
const docs = join(site, 'src', 'content', 'docs');
const dist = join(site, 'dist');
const REPO = 'https://github.com/pixelqueue/opencharacter';

interface Page {
  /** Route inside the site (`guides/quick-start`; '' for the home page). */
  route: string;
  title: string;
  description: string | undefined;
  /** The page's Markdown, links absolute, no front matter. */
  body: string;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** Root-relative links to the site (`/opencharacter/spec/`) as absolute URLs. */
const absolute = (text: string) =>
  text.replaceAll(`](${BASE}/`, `](${SITE}`).replaceAll(`href="${BASE}/`, `href="${SITE}`);

/** The synced Markdown pages (the MDX home page is described by llms.txt itself). */
function pages(): Page[] {
  return files(docs)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const text = readFileSync(file, 'utf8');
      const end = text.indexOf('\n---\n', 4);
      const front = parse(text.slice(4, end)) as { title: string; description?: string };
      const route = relative(docs, file)
        .replace(/\.md$/, '')
        .replace(/(^|\/)index$/, '');
      return {
        route,
        title: front.title,
        description: front.description,
        body: absolute(text.slice(end + 5).replace(/^\n+/, '')),
      };
    });
}

const url = (route: string) => `${SITE}${route}.md`;
const link = (p: Page) =>
  `- [${p.title}](${url(p.route)})${p.description ? `: ${p.description}` : ''}`;
// The description is the page's own first paragraph, so the copy doesn't repeat it.
const markdown = (p: Page) => `# ${p.title}\n\n${p.body.trimEnd()}\n`;

function write(path: string, text: string) {
  const file = join(dist, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

interface PackInfo {
  id: string;
  name: string;
  version: string;
  license: string;
  npm: string;
  source: string;
  homepage?: string;
  dependencies: string[];
}

function packs(): PackInfo[] {
  const root = join(repo, 'packs');
  return readdirSync(root)
    .filter((game) => statSync(join(root, game)).isDirectory())
    .flatMap((game) => readdirSync(join(root, game)).map((pack) => `${game}/${pack}`))
    .filter((path) => existsSync(join(root, path, 'pack.yaml')))
    .map((path) => {
      const manifest = parse(readFileSync(join(root, path, 'pack.yaml'), 'utf8')) as {
        id: string;
        version: string;
        license: string;
        defaultLanguage: string;
        homepage?: string;
        dependencies?: Record<string, string>;
      };
      const text = readI18n(join(root, path), manifest.defaultLanguage);
      return {
        id: manifest.id,
        name: text['pack.name'] ?? manifest.id,
        version: manifest.version,
        license: manifest.license,
        npm: `@opencharacter/${manifest.id}`,
        source: `${REPO}/tree/main/packs/${path}`,
        ...(manifest.homepage ? { homepage: manifest.homepage } : {}),
        dependencies: Object.keys(manifest.dependencies ?? {}),
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

const all = pages();
const byRoute = new Map(all.map((p) => [p.route, p]));
const inOrder = (routes: string[]) =>
  routes.map((r) => byRoute.get(r)).filter((p): p is Page => p !== undefined);
const guides = inOrder(GUIDE_ORDER.map((n) => (n === 'README' ? 'guides' : `guides/${n}`)));
const spec = inOrder(SPEC_ORDER.map((n) => (n === 'README' ? 'spec' : `spec/${n}`)));
const project = inOrder(['project/glossary', 'project/packages', 'project/contributing']);
const packList = packs();
const schemas = files(join(dist, 'schemas'))
  .map((f) => relative(dist, f))
  .toSorted();

for (const page of all) write(`${page.route}.md`, markdown(page));

write(
  'llms.txt',
  `# Open Character Format (OCF)

> One character format for every tabletop RPG. Packs hold a game's rules as data (fields,
> formulas, content); a reference engine computes characters from them; every app that speaks
> OCF reads the same character files.

- The engine knows the rules; the app owns the experience. Apps never write a game's math: they
  load packs into a ruleset, call the engine, and render what it returns.
- A character file holds only base state (inputs, owned items, picks). Every value is computed by
  \`computeSheet\`, with a breakdown of where it came from.
- Engine calls: \`loadRuleset\`, \`computeSheet\`, \`listOptions\`, \`applyChanges\`, \`startAction\`,
  \`continueAction\`, \`upgrade\`. The engine returns keys and codes, never display text.
- npm: \`@opencharacter/engine\` (the TypeScript reference engine, no runtime dependencies),
  \`@opencharacter/spec\` (docs, JSON Schemas, conformance suite), \`@opencharacter/text\`
  (wording helper), \`@opencharacter/packs\` (every official pack), and one package per pack.
- Spec version ${SPEC_VERSION}. Source: ${REPO}. Code and spec are Apache-2.0; each pack keeps its own license.
- Every page below is Markdown; the website has each one as HTML at the same path without \`.md\`.
  [llms-full.txt](${SITE}llms-full.txt) holds every guide and spec chapter in one file.

## Guides

${guides.map(link).join('\n')}

## Specification

${spec.map(link).join('\n')}

## Official packs

${packList.map((p) => `- [${p.name}](${p.source}): \`${p.id}\` ${p.version}, ${p.license}, npm \`${p.npm}\``).join('\n')}

## Machine-readable

- [packs.json](${SITE}packs.json): the official packs as JSON (ID, name, version, license, npm package, source, dependencies)
${schemas.map((s) => `- [${s.replace(/^schemas\/[^/]+\//, '')}](${SITE}${s}): JSON Schema (draft 2020-12)`).join('\n')}

## Optional

${project.map(link).join('\n')}
`,
);

write(
  'llms-full.txt',
  `# Open Character Format (OCF): the guides and the specification

> Every guide and spec chapter of ${SITE}, in reading order. Source: ${REPO}.

${[...guides, ...spec].map((p) => `${markdown(p)}\nSource: ${SITE}${p.route}/\n`).join('\n---\n\n')}`,
);

write('packs.json', `${JSON.stringify({ packs: packList }, null, 2)}\n`);

write(
  'robots.txt',
  `# Open Character Format: open to search engines and AI crawlers alike.
# For agents: ${SITE}llms.txt (an index) and ${SITE}llms-full.txt (every guide and spec chapter).
# Search engines read robots.txt only at a domain's root.

User-agent: *
Allow: /
Disallow: ${BASE}/pagefind/

Sitemap: ${SITE}sitemap-index.xml
`,
);

console.log(
  `wrote ${all.length} Markdown pages, llms.txt, llms-full.txt, packs.json and robots.txt into ${relative(repo, dist)}`,
);
