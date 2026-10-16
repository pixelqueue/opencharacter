import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { BASE as PATH, SITE } from '../site.ts';

// Search and agent metadata for every page, on top of Starlight's own head (title, canonical,
// description, Open Graph basics):
// - the home page's title and type, and its JSON-LD (the site and the software);
// - the social image on every page;
// - JSON-LD for each doc page (an article in a breadcrumb trail);
// - a link to each page's Markdown copy (written by scripts/agent-files.ts), for agents.

const BASE = `${PATH}/`;
const REPO = 'https://github.com/pixelqueue/opencharacter';
const NAME = 'Open Character Format';

const HOME_TITLE = 'Open Character Format (OCF): one character format for every tabletop RPG';

const SECTIONS: Record<string, { name: string; path: string }> = {
  guides: { name: 'Guides', path: 'guides/' },
  spec: { name: 'Specification', path: 'spec/' },
  project: { name: 'Project', path: 'project/glossary/' },
};

type Head = { tag: string; attrs?: Record<string, string | boolean | undefined>; content?: string };

const meta = (attrs: Record<string, string>): Head => ({ tag: 'meta', attrs });
const jsonLd = (data: unknown): Head => ({
  tag: 'script',
  attrs: { type: 'application/ld+json' },
  content: JSON.stringify(data),
});

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const head = route.head as Head[];
  const path = context.url.pathname.startsWith(BASE)
    ? context.url.pathname.slice(BASE.length).replace(/\/$/, '')
    : '';
  const url = `${SITE}${path ? `${path}/` : ''}`;
  const data = route.entry.data as { title: string; description?: string };
  const isHome = path === '';

  const find = (match: (h: Head) => boolean) => head.find(match);
  const setMeta = (key: 'name' | 'property', name: string, content: string) => {
    const found = find((h) => h.tag === 'meta' && h.attrs?.[key] === name);
    if (found?.attrs) found.attrs.content = content;
    else head.push(meta({ [key]: name, content }));
  };

  setMeta('property', 'og:image', `${SITE}og.png`);
  setMeta('property', 'og:image:width', '1200');
  setMeta('property', 'og:image:height', '630');
  setMeta('property', 'og:image:alt', `${NAME}: one character format for every tabletop RPG`);
  setMeta('name', 'twitter:image', `${SITE}og.png`);

  if (isHome) {
    const title = find((h) => h.tag === 'title');
    if (title) title.content = HOME_TITLE;
    setMeta('property', 'og:title', HOME_TITLE);
    setMeta('property', 'og:type', 'website');
    head.push(
      { tag: 'link', attrs: { rel: 'alternate', type: 'text/plain', href: `${BASE}llms.txt` } },
      jsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': `${SITE}#website`,
            name: NAME,
            alternateName: 'OCF',
            url: SITE,
            description: data.description,
            inLanguage: 'en',
          },
          {
            '@type': 'SoftwareSourceCode',
            '@id': `${SITE}#software`,
            name: NAME,
            alternateName: 'OCF',
            description: data.description,
            url: SITE,
            codeRepository: REPO,
            programmingLanguage: ['TypeScript', 'JSON Schema', 'YAML'],
            license: 'https://www.apache.org/licenses/LICENSE-2.0',
            keywords: [
              'tabletop RPG',
              'TTRPG',
              'character sheet',
              'character data format',
              '5E SRD',
              'ORC License',
              'Forged in the Dark',
              'virtual tabletop',
              'VTT',
              'rules engine',
            ],
          },
        ],
      }),
    );
    return;
  }

  // The not-found page: nothing to index, no Markdown copy.
  if (route.entry.id === '404') {
    head.push(meta({ name: 'robots', content: 'noindex' }));
    return;
  }

  // Written by scripts/agent-files.ts.
  if (path) {
    head.push({
      tag: 'link',
      attrs: { rel: 'alternate', type: 'text/markdown', href: `${BASE}${path}.md` },
    });
  }

  const section = SECTIONS[path.split('/')[0] ?? ''];
  const crumbs = [
    { name: NAME, url: SITE },
    ...(section && `${section.path}` !== `${path}/`
      ? [{ name: section.name, url: `${SITE}${section.path}` }]
      : []),
    { name: data.title, url },
  ];
  head.push(
    jsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'TechArticle',
          headline: data.title,
          description: data.description,
          url,
          inLanguage: 'en',
          isPartOf: { '@id': `${SITE}#website` },
          about: { '@id': `${SITE}#software` },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: crumbs.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            item: c.url,
          })),
        },
      ],
    }),
  );
});
