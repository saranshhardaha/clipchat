import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/helpers/fixtures.ts'],
    testTimeout: 30000,
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
