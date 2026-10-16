import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url));

// Workspace packages resolve to their TypeScript sources, so the editor needs no build first.
const source = '@opencharacter/source';

function api(): Plugin {
  return {
    name: 'ocf-editor-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Loaded through Vite (not imported by this config) so it resolves workspace sources.
        server
          .ssrLoadModule('/server/api.ts')
          .then((mod) => (mod as typeof import('./server/api.ts')).handle(root, req, res))
          .then((handled) => {
            if (!handled) next();
          }, next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), api()],
  resolve: { conditions: [source, 'module', 'browser', 'development|production'] },
  ssr: { resolve: { conditions: [source, 'module', 'node', 'development|production'] } },
  // The OCF icon (and nothing else the editor needs) lives in the website's public folder.
  publicDir: fileURLToPath(new URL('../website/public', import.meta.url)),
  server: { host: '127.0.0.1', port: 5173, open: true },
});
