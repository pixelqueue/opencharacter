// @ts-check
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { BASE, ORIGIN } from './site.ts';

const base = BASE;

// In dev, send pages outside the base (/spec/) to the same path under it (/opencharacter/spec/).
// Astro answers those with a 404 before any middleware runs, so this wraps the server's handler.
/** @type {import('vite').Plugin} */
const redirectToBase = {
  name: 'redirect-to-base',
  configureServer(server) {
    const http = server.httpServer;
    http?.once('listening', () => {
      const handlers = http.listeners('request');
      http.removeAllListeners('request');
      http.on('request', (req, res) => {
        const url = req.url ?? '/';
        if (!url.startsWith(base) && (req.headers.accept ?? '').includes('text/html')) {
          res.writeHead(302, { Location: base + url });
          res.end();
          return;
        }
        for (const handle of handlers) handle.call(http, req, res);
      });
    });
  },
};

export default defineConfig({
  site: ORIGIN,
  base,
  vite: { plugins: base ? [redirectToBase] : [] },
  integrations: [
    sitemap(),
    starlight({
      title: 'Open Character Format',
      // public/favicon.svg is the icon's only copy: the README and the pack editor use it too.
      logo: { src: './public/favicon.svg' },
      description:
        'An open, community-maintained format for tabletop RPG character data, for any game.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/pixelqueue/opencharacter' },
      ],
      sidebar: [
        // apps/website/guides/README.md lists the guides in the same groups.
        {
          label: 'Start here',
          items: [
            { slug: 'guides', label: 'Overview' },
            'guides/quick-start',
            'guides/implementing',
            'guides/other-languages',
          ],
        },
        {
          label: 'Showing characters',
          items: [
            'guides/packs-and-rulesets',
            'guides/storing-characters',
            'guides/showing-a-sheet',
            'guides/text-and-translation',
            'guides/showing-text',
          ],
        },
        {
          label: 'Changing characters',
          items: [
            'guides/changing-characters',
            'guides/building-characters',
            'guides/upgrading-characters',
          ],
        },
        { label: 'Playing', items: ['guides/rolling-dice', 'guides/other-characters'] },
        { label: 'Specification', items: [{ autogenerate: { directory: 'spec' } }] },
        {
          label: 'Project',
          items: [
            'project/glossary',
            'project/contributing',
            'project/working-in-the-repo',
            'project/code-of-conduct',
            'project/packages',
          ],
        },
      ],
      lastUpdated: false,
      routeMiddleware: './src/routeData.ts',
      // Every border on the site is 2px (src/styles/site.css), code blocks too.
      expressiveCode: { styleOverrides: { borderWidth: '2px' } },
      components: { Head: './src/components/Head.astro' },
      customCss: ['@fontsource-variable/jetbrains-mono/wght.css', './src/styles/site.css'],
    }),
  ],
});
