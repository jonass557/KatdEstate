import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    teardownTimeout: 60_000,
  },
});
