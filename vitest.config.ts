import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: resolve(__dirname),
    globalSetup: 'test/fixtures/generate.ts',
    coverage: {
      provider: 'v8',
      include: ['src/main/**/*.ts', 'src/shared/**/*.ts', 'src/renderer/lib/**/*.ts'],
      exclude: ['src/main/index.ts', 'src/main/ipc-handlers.ts', 'src/renderer/lib/api.ts'],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
