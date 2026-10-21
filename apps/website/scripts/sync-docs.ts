import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { readI18n } from '../../../scripts/validate/load.ts';
import { BASE } from '../site.ts';

// Copies the repo's documentation into the site (src/content/docs), so the Markdown lives in one
// place. Each file's first `# heading` becomes its Starlight title; links between synced docs
// become site links (with the base path); links to anything else in the repo go to GitHub.

const GITHUB = 'https://github.com/pixelqueue/opencharacter';
const site = fileURLToPath(new URL('..', import.meta.url));
const repo = join(site, '..', '..');

export const SPEC_ORDER = [
  'README',
  'packs',
  'rules-and-fields',
  'content',
  'effects',
  'formulas',
  'dice-and-actions',
  'characters',
  'engine-interface',
  'engine-core',
  'engine-actions',
  'display-hints',
  'i18n',
  'upgrades',
  'versioning',
];

/** The sidebar groups the guides in astro.config.mjs. */
export const GUIDE_ORDER = [
  'README',
  'quick-start',
  'implementing',
  'other-languages',
  'packs-and-rulesets',
  'storing-characters',
  'showing-a-sheet',
  'text-and-translation',
  'showing-text',
  'changing-characters',
  'building-characters',
  'upgrading-characters',
  'rolling-dice',
  'other-characters',
];

export interface Page {
  source: string;
  /** Route inside the site, without base (`spec/effects`). */
  route: string;
  order?: number;
  /** The page's Markdown, when it isn't the source file's. */
  text?: string;
  mdx?: boolean;
}

export function pages(root: string): Page[] {
  const out: Page[] = [];
  for (const file of readdirSync(join(root, 'packages/spec/docs')).filter((f) =>
    f.endsWith('.md'),
  )) {
    const name = file.replace(/\.md$/, '');
    out.push({
      source: `packages/spec/docs/${file}`,
      route: name === 'README' ? 'spec' : `spec/${name}`,
      order: SPEC_ORDER.indexOf(name),
    });
  }
  for (const file of readdirSync(join(root, 'apps/website/guides')).filter((f) =>
    f.endsWith('.md'),
  )) {
    const name = file.replace(/\.md$/, '');
    out.push({
      source: `apps/website/guides/${file}`,
      route: name === 'README' ? 'guides' : `guides/${name}`,
      order: GUIDE_ORDER.indexOf(name),
    });
  }
  const project: [string, string][] = [
    ['apps/website/glossary.md', 'project/glossary'],
    ['CONTRIBUTING.md', 'project/contributing'],
    ['AGENTS.md', 'project/working-in-the-repo'],
    ['CODE_OF_CONDUCT.md', 'project/code-of-conduct'],
  ];
  project.forEach(([source, route], i) => out.push({ source, route, order: i }));
  out.push(packagesPage(root, project.length));
  return out;
}

interface Ecosystem {
  apply: string;
  tags: Record<string, string>;
  apps: { name: string; description: string; url?: string; tags: string[] }[];
}

const LICENSES: Record<string, string> = {
  'mechanics-only': 'Mechanics only',
  ORC: 'ORC License',
  'OGL-1.0a': 'OGL 1.0a',
};

/** MDX text: escapes the characters MDX reads as JSX or expressions. */
const mdx = (text: string) => text.replace(/[{}<>|]/g, (c) => `\\${c}`);

/**
 * The home page's packs and apps sections (MDX), from `data/ecosystem.yaml` and each pack's own
 * files. The home page marks where they go with an `ecosystem` MDX comment.
 */
function ecosystem(root: string): string {
  const data = parse(readFileSync(join(site, 'data/ecosystem.yaml'), 'utf8')) as Ecosystem;
  const packs = readdirSync(join(root, 'packs'))
    .flatMap((game) =>
      existsSync(join(root, 'packs', game)) && statSync(join(root, 'packs', game)).isDirectory()
        ? readdirSync(join(root, 'packs', game)).map((pack) => `${game}/${pack}`)
        : [],
    )
    .filter((path) => existsSync(join(root, 'packs', path, 'pack.yaml')))
    .map((path) => {
      const dir = join(root, 'packs', path);
      const manifest = parse(readFileSync(join(dir, 'pack.yaml'), 'utf8')) as {
        id: string;
        license: string;
        defaultLanguage: string;
      };
      const text = readI18n(dir, manifest.defaultLanguage);
      return { path, manifest, name: text['pack.name'] ?? manifest.id };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map(({ path, manifest, name }) => {
      const source = rewriteLink(`packs/${path}`, 'README.md', new Map());
      const license = LICENSES[manifest.license] ?? manifest.license;
      return `| [${mdx(name)}](${source}) | \`${manifest.id}\` | ${license} |`;
    });
  const apps = data.apps.map((app) => {
    const unknown = app.tags.filter((t) => !data.tags[t]);
    if (unknown.length > 0) throw new Error(`${app.name}: unknown tags ${unknown.join(', ')}`);
    const badges = app.tags.map((t) => `<Badge text=${JSON.stringify(data.tags[t])} />`);
    const name = app.url
      ? `<a class="ocf-app-name" href=${JSON.stringify(app.url)}>${mdx(app.name)}</a>`
      : `<span class="ocf-app-name">${mdx(app.name)}</span>`;
    return [
      '<div class="ocf-app">',
      `<div class="ocf-app-head">${name}<span class="ocf-app-tags">${badges.join(' ')}</span></div>`,
      `<p class="ocf-app-description">${mdx(app.description)}</p>`,
      '</div>',
    ].join('\n');
  });
  return [
    '<div class="ocf-section">',
    '',
    '## Official packs',
    '',
    '| Pack | ID | License |',
    '| --- | --- | --- |',
    ...packs,
    '',
    "_Mechanics only_: the game isn't openly licensed, so the pack holds its math and names, no",
    "rules text, and isn't affiliated with or endorsed by its publisher.",
    '',
    '</div>',
    '',
    '<div class="ocf-section">',
    '',
    // The heading shares its row with the apply button (Starlight's own heading anchor isn't
    // needed on the home page, which has no table of contents).
    '<div class="ocf-section-head">',
    '<h2 id="built-with-ocf">Built with OCF</h2>',
    `<a class="sl-link-button secondary not-content" href=${JSON.stringify(data.apply)} target="_blank" rel="noopener">Apply to be listed</a>`,
    '</div>',
    '',
    `<div class="ocf-apps">\n${apps.join('\n')}\n</div>`,
    '',
    '</div>',
    '',
  ].join('\n');
}

function folders(root: string, dir: string): string[] {
  if (!existsSync(join(root, dir))) return [];
  return readdirSync(join(root, dir))
    .filter((name) => statSync(join(root, dir, name)).isDirectory())
    .map((name) => `${dir}/${name}`);
}

/** The apps (the website, the local pack editor) are never published, so they aren't listed. */
function packagesPage(root: string, order: number): Page {
  const dirs = [
    ...folders(root, 'packages'),
    ...folders(root, 'packs').flatMap((game) => folders(root, game)),
  ];
  const rows = dirs
    .filter((dir) => existsSync(join(root, dir, 'package.json')))
    .map((dir) => {
      const pkg = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')) as {
        name: string;
        description?: string;
      };
      return { dir, pkg };
    })
    .filter(({ pkg }) => pkg.name.startsWith('@opencharacter/'))
    .map(({ dir, pkg }) => {
      const source = rewriteLink(dir, 'README.md', new Map());
      const description = pkg.description ?? '';
      return {
        group: dir.startsWith('packs/') ? 1 : 0,
        name: pkg.name,
        entry: `<div class="ocf-package">\n\n[${pkg.name}](${source})\n\n${description}\n\n</div>`,
      };
    })
    .toSorted((a, b) => a.group - b.group || a.name.localeCompare(b.name));
  const list = (group: number) =>
    rows.filter((r) => r.group === group).flatMap((r) => [r.entry, '']);
  const text = [
    '# Packages',
    '',
    'Every package this repository publishes to npm, under the `@opencharacter` scope.',
    '',
    '## Spec, engine and tools',
    '',
    ...list(0),
    '## Packs',
    '',
    ...list(1),
  ].join('\n');
  return { source: 'package.json', route: 'project/packages', order, text };
}

function home(root: string): string {
  const text = readFileSync(join(site, 'home.md'), 'utf8');
  const end = text.indexOf('\n---\n', 4) + 5;
  const imports = "import { Badge } from '@astrojs/starlight/components';\n\n";
  const body = text.slice(end).replace('{/* ecosystem */}', ecosystem(root).trimEnd());
  return `${text.slice(0, end)}\n${imports}${body.replace(/^\n+/, '')}`;
}

export function rewriteLink(target: string, from: string, routes: Map<string, string>): string {
  if (/^([a-z]+:|\/)/i.test(target)) return target;
  const [path = '', hash = ''] = target.split('#');
  const resolved = path === '' ? from : posix.normalize(posix.join(posix.dirname(from), path));
  const anchor = hash ? `#${hash}` : '';
  if (path === '') return target;
  const route = routes.get(resolved) ?? routes.get(posix.join(resolved, 'README.md'));
  if (route !== undefined) return `${BASE}/${route}/${anchor}`;
  if (resolved.startsWith('..')) return target;
  const isDir = existsSync(join(repo, resolved)) && statSync(join(repo, resolved)).isDirectory();
  return `${GITHUB}/${isDir ? 'tree' : 'blob'}/main/${resolved}${anchor}`;
}

export function convert(text: string, page: Page, routes: Map<string, string>): string {
  const lines = text.split('\n');
  const h1 = lines.findIndex((l) => l.startsWith('# '));
  const title =
    h1 >= 0 ? (lines[h1] as string).slice(2).trim() : (page.route.split('/').pop() ?? page.route);
  if (h1 >= 0) lines.splice(h1, 1);
  let body = lines.join('\n');
  body = body
    .split(/(```[\s\S]*?```)/)
    .map((chunk) =>
      chunk.startsWith('```')
        ? chunk
        : chunk.replace(
            /(!?)\[([^\]\n]*)\]\(([^)\s]+)\)/g,
            (_, bang: string, label: string, t: string) =>
              `${bang}[${label}](${rewriteLink(t, page.source, routes)})`,
          ),
    )
    .join('');
  const front = ['---', `title: ${JSON.stringify(title)}`];
  const description = describe(body);
  if (description) front.push(`description: ${JSON.stringify(description)}`);
  if (page.order !== undefined && page.order >= 0) front.push('sidebar:', `  order: ${page.order}`);
  front.push('---', '');
  return `${front.join('\n')}${body.replace(/^\n+/, '')}`;
}

/** Markdown as plain text: links, code, emphasis and HTML reduced to their words. */
const plain = (md: string) =>
  md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** A page's meta description: its first paragraph of prose, cut at a word to at most 160 characters. */
export function describe(body: string): string | undefined {
  const prose = body
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find(
      (block) =>
        block !== '' &&
        !/^(#|\||-|\*|>|<|\d+\.|import |\{\/\*)/.test(block) &&
        plain(block).length > 40,
    );
  // A lead-in to a list ("The spec covers three layers:") ends as a sentence.
  const raw = plain(prose ?? '').replace(/:$/, '.');
  const text = raw.charAt(0).toUpperCase() + raw.slice(1);
  if (!text) return undefined;
  if (text.length <= 160) return text;
  const cut = text.slice(0, 159);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}

function filesUnder(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    return statSync(path).isDirectory() ? filesUnder(path, rel) : [rel];
  });
}

function removeEmptyFolders(dir: string): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    removeEmptyFolders(path);
    if (readdirSync(path).length === 0) rmSync(path, { recursive: true });
  }
}

/**
 * Makes `out` hold exactly `files` (relative path → contents), writing only files that changed
 * and removing stale ones. Never deletes the folder itself, so a running `astro dev` watching it
 * doesn't see every page vanish and come back (its content store can end up empty).
 */
function mirror(out: string, files: Map<string, string | Buffer>): void {
  for (const rel of filesUnder(out)) if (!files.has(rel)) rmSync(join(out, rel));
  removeEmptyFolders(out);
  for (const [rel, data] of files) {
    const file = join(out, rel);
    if (existsSync(file) && readFileSync(file).equals(Buffer.from(data))) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, data);
  }
}

export function sync(root: string, out: string): Page[] {
  const list = pages(root);
  const routes = new Map(list.map((p) => [p.source, p.route]));
  const docs = new Map<string, string>();
  for (const page of list) {
    const index = page.route === 'spec' || page.route === 'guides';
    const text = page.text ?? readFileSync(join(root, page.source), 'utf8');
    const ext = page.mdx ? 'mdx' : 'md';
    docs.set(
      index ? `${page.route}/index.${ext}` : `${page.route}.${ext}`,
      convert(text, page, routes),
    );
  }
  docs.set('index.mdx', home(root));
  mirror(out, docs);
  const source = join(root, 'packages/spec/schemas');
  const schemas = new Map(filesUnder(source).map((rel) => [rel, readFileSync(join(source, rel))]));
  mirror(join(site, 'public', 'schemas', '0.1'), schemas);
  return list;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const list = sync(repo, join(site, 'src', 'content', 'docs'));
  console.log(`synced ${list.length} pages and the JSON Schemas into ${relative(repo, site)}`);
}
