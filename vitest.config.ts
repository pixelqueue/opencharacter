import { defineConfig } from 'vitest/config';

const conditions = ['@opencharacter/source', 'module', 'node', 'development|production'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
