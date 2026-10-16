import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { handle } from './server/api.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));

function api(): Plugin {
  return {
    name: 'ocf-editor-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handle(root, req, res).then((handled) => {
          if (!handled) next();
        }, next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), api()],
  // The OCF icon (and nothing else the editor needs) lives in the website's public folder.
  publicDir: fileURLToPath(new URL('../website/public', import.meta.url)),
  server: { host: '127.0.0.1', port: 5173, open: true },
});
